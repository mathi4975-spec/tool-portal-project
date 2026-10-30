// ATC Radar Simulator.
// World units: x runs east, y runs north, both in nautical miles (nm).
// The airport is at (0, 0). Headings are compass degrees (0 = north, 90 = east).
(function () {
  'use strict';

  var AIRSPACE_RADIUS = 40;   // planes enter here
  var VIEW_RADIUS = 44;       // the radar shows a little more than the airspace
  var SEP_DISTANCE = 3;       // nm
  var SEP_HEIGHT = 1000;      // ft
  var WARN_DISTANCE = 6;
  var WARN_HEIGHT = 2000;

  // Game time runs faster than real time so a round does not take hours.
  var KNOT_TO_NM_PER_SEC = 1 / 120;
  var TURN_RATE = 15;         // degrees per second
  var CLIMB_RATE = 300;       // ft per second
  var ACCEL = 15;             // kt per second
  var MIN_SPEED = 120, MAX_SPEED = 300;
  var MIN_ALT = 1000, MAX_ALT = 12000;

  var RUNWAY_HEADING = 90;
  var LAND_MAX_DIST = 12;     // nm west of the airport
  var LAND_MAX_OFFSET = 3;    // nm either side of the runway line
  var LAND_MAX_TURN = 25;     // degrees off the runway heading
  var LAND_MAX_ALT = 2000;
  var LAND_MAX_SPEED = 180;

  var MAX_PLANES = 8;
  var PREFIXES = ['BA', 'QF', 'VA', 'EK', 'SQ', 'UA', 'DL', 'AF'];

  var canvas = document.getElementById('radar');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var listEl = document.getElementById('aircraft-list');
  var messagesEl = document.getElementById('messages');
  var selectedEl = document.getElementById('selected-name');
  var pauseBtn = document.getElementById('pause');
  var commandInput = document.getElementById('command');
  var controlButtons = document.querySelectorAll('.controls button');

  var state = {};
  var rows = {};              // callsign -> list button
  var view = { size: 0, dpr: 1 };

  // Exposed only so the game can be checked from a browser test.
  window.radarDebug = state;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function norm(deg) { return ((deg % 360) + 360) % 360; }
  function pad3(n) { return ('00' + Math.round(n)).slice(-3); }
  function shortestTurn(from, to) { return ((to - from + 540) % 360) - 180; }

  function loadBest() {
    try { return parseInt(localStorage.getItem('radarBest'), 10) || 0; } catch (e) { return 0; }
  }
  function saveBest(value) {
    try { localStorage.setItem('radarBest', String(value)); } catch (e) {}
  }

  function say(text) {
    var line = document.createElement('div');
    line.textContent = text;
    messagesEl.appendChild(line);
    while (messagesEl.children.length > 5) messagesEl.removeChild(messagesEl.firstChild);
  }

  function reset() {
    state.planes = [];
    state.selected = null;
    state.score = 0;
    state.best = state.best || loadBest();
    state.paused = false;
    state.over = false;
    state.spawnInterval = 12;
    state.spawnTimer = 4;
    state.conflict = null;
    messagesEl.textContent = '';
    listEl.textContent = '';
    rows = {};
    pauseBtn.textContent = 'Pause';
    spawnPlane();
    say('New game. Planes are arriving.');
  }

  function newCallsign() {
    var cs;
    do {
      cs = PREFIXES[Math.floor(Math.random() * PREFIXES.length)] + (10 + Math.floor(Math.random() * 90));
    } while (findPlane(cs));
    return cs;
  }

  function findPlane(cs) {
    for (var i = 0; i < state.planes.length; i++) {
      if (state.planes[i].cs === cs) return state.planes[i];
    }
    return null;
  }

  function spawnPlane() {
    for (var tries = 0; tries < 10; tries++) {
      var angle = Math.random() * 2 * Math.PI;
      var x = AIRSPACE_RADIUS * Math.sin(angle);
      var y = AIRSPACE_RADIUS * Math.cos(angle);
      var alt = (4 + Math.floor(Math.random() * 6)) * 1000;
      if (nearAnyPlane(x, y, alt)) continue;
      var heading = norm(angle * 180 / Math.PI + 180 + (Math.random() * 40 - 20));
      var speed = 200 + Math.floor(Math.random() * 4) * 20;
      var plane = {
        cs: newCallsign(), x: x, y: y,
        heading: heading, targetHeading: heading,
        alt: alt, targetAlt: alt,
        speed: speed, targetSpeed: speed,
        warn: false
      };
      state.planes.push(plane);
      say(plane.cs + ' has entered your airspace.');
      return;
    }
  }

  function nearAnyPlane(x, y, alt) {
    return state.planes.some(function (p) {
      return Math.hypot(p.x - x, p.y - y) < 10 && Math.abs(p.alt - alt) < 2000;
    });
  }

  function removePlane(plane) {
    state.planes.splice(state.planes.indexOf(plane), 1);
    if (state.selected === plane) state.selected = null;
    if (rows[plane.cs]) {
      rows[plane.cs].parentNode.remove();
      delete rows[plane.cs];
    }
  }

  function addScore(points) {
    state.score += points;
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
  }

  // ----- Orders (used by both typed commands and buttons) -----

  function setHeading(plane, value) {
    plane.targetHeading = norm(value);
    say(plane.cs + ': turning to heading ' + pad3(plane.targetHeading) + '.');
  }

  function setAltitude(plane, value) {
    plane.targetAlt = value;
    say(plane.cs + ': ' + (value >= plane.alt ? 'climbing' : 'descending') + ' to ' + value + ' ft.');
  }

  function setSpeed(plane, value) {
    plane.targetSpeed = value;
    say(plane.cs + ': changing speed to ' + value + ' kt.');
  }

  function tryLand(plane) {
    var problems = [];
    if (plane.x > 0 || plane.x < -LAND_MAX_DIST || Math.abs(plane.y) > LAND_MAX_OFFSET) {
      problems.push('it is not on the dashed line west of the airport (within ' + LAND_MAX_DIST + ' nm)');
    }
    if (Math.abs(shortestTurn(plane.heading, RUNWAY_HEADING)) > LAND_MAX_TURN) {
      problems.push('it is not heading about ' + pad3(RUNWAY_HEADING));
    }
    if (plane.alt > LAND_MAX_ALT) problems.push('it is above ' + LAND_MAX_ALT + ' ft');
    if (plane.speed > LAND_MAX_SPEED) problems.push('it is faster than ' + LAND_MAX_SPEED + ' kt');

    if (problems.length) {
      say(plane.cs + ' cannot land yet: ' + problems.join('; ') + '.');
      return;
    }
    removePlane(plane);
    addScore(100);
    say(plane.cs + ' landed safely. +100');
  }

  function runCommand(text) {
    var tokens = text.trim().toUpperCase().split(/\s+/);
    if (!tokens[0]) return;
    if (state.over) { say('The game is over. Press Restart to play again.'); return; }
    if (state.paused) { say('The game is paused. Press Resume.'); return; }

    var plane = findPlane(tokens[0]);
    if (!plane) { say('No plane called ' + tokens[0] + ' is on the radar.'); return; }

    var verb = tokens[1];
    var value = /^\d+$/.test(tokens[2] || '') ? parseInt(tokens[2], 10) : NaN;

    if (verb === 'LAND') {
      tryLand(plane);
    } else if (verb === 'H') {
      if (isNaN(value) || value > 360) say('A heading is a number from 0 to 360, for example ' + plane.cs + ' H 270.');
      else setHeading(plane, value);
    } else if (verb === 'A') {
      if (isNaN(value) || value < MIN_ALT || value > MAX_ALT) say('Altitude must be a number from ' + MIN_ALT + ' to ' + MAX_ALT + ' ft.');
      else setAltitude(plane, value);
    } else if (verb === 'S') {
      if (isNaN(value) || value < MIN_SPEED || value > MAX_SPEED) say('Speed must be a number from ' + MIN_SPEED + ' to ' + MAX_SPEED + ' kt.');
      else setSpeed(plane, value);
    } else {
      say('Commands: ' + plane.cs + ' H 270, ' + plane.cs + ' A 5000, ' + plane.cs + ' S 180 or ' + plane.cs + ' LAND.');
    }
  }

  function runButton(action) {
    var p = state.selected;
    if (!p || state.over || state.paused) return;
    if (action === 'left') setHeading(p, p.targetHeading - 10);
    else if (action === 'right') setHeading(p, p.targetHeading + 10);
    else if (action === 'climb') setAltitude(p, clamp(p.targetAlt + 1000, MIN_ALT, MAX_ALT));
    else if (action === 'descend') setAltitude(p, clamp(p.targetAlt - 1000, MIN_ALT, MAX_ALT));
    else if (action === 'faster') setSpeed(p, clamp(p.targetSpeed + 20, MIN_SPEED, MAX_SPEED));
    else if (action === 'slower') setSpeed(p, clamp(p.targetSpeed - 20, MIN_SPEED, MAX_SPEED));
    else if (action === 'land') tryLand(p);
  }

  // ----- Simulation -----

  function update(dt) {
    state.planes.slice().forEach(function (p) {
      var turn = shortestTurn(p.heading, p.targetHeading);
      p.heading = norm(p.heading + clamp(turn, -TURN_RATE * dt, TURN_RATE * dt));
      p.alt += clamp(p.targetAlt - p.alt, -CLIMB_RATE * dt, CLIMB_RATE * dt);
      p.speed += clamp(p.targetSpeed - p.speed, -ACCEL * dt, ACCEL * dt);

      var dist = p.speed * KNOT_TO_NM_PER_SEC * dt;
      var rad = p.heading * Math.PI / 180;
      p.x += Math.sin(rad) * dist;
      p.y += Math.cos(rad) * dist;

      if (Math.hypot(p.x, p.y) > VIEW_RADIUS) {
        removePlane(p);
        addScore(-50);
        say(p.cs + ' left your airspace. -50');
      }
    });

    checkSeparation();

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (state.planes.length < MAX_PLANES) spawnPlane();
      state.spawnInterval = Math.max(5, state.spawnInterval - 0.4);
      state.spawnTimer = state.spawnInterval;
    }
  }

  function checkSeparation() {
    var planes = state.planes;
    planes.forEach(function (p) { p.warn = false; });
    for (var i = 0; i < planes.length; i++) {
      for (var j = i + 1; j < planes.length; j++) {
        var a = planes[i], b = planes[j];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        var dv = Math.abs(a.alt - b.alt);
        if (d < WARN_DISTANCE && dv < WARN_HEIGHT) { a.warn = true; b.warn = true; }
        if (d < SEP_DISTANCE && dv < SEP_HEIGHT) {
          state.over = true;
          state.conflict = [a, b];
          say('Game over: ' + a.cs + ' and ' + b.cs + ' came too close. Final score: ' + state.score + '.');
          return;
        }
      }
    }
  }

  // ----- Drawing -----

  function colours() {
    var css = getComputedStyle(document.documentElement);
    function get(name) { return css.getPropertyValue(name).trim(); }
    // The radar is a dark screen in both themes, so it uses the screen colours.
    return {
      surface: get('--screen'), border: get('--screen-line'), text: get('--screen-ink'),
      link: get('--glow'), danger: get('--screen-danger')
    };
  }

  function resize() {
    view.size = canvas.clientWidth;
    view.dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = Math.round(view.size * view.dpr);
  }

  function scale() { return view.size / 2 / VIEW_RADIUS; }
  function px(x) { return view.size / 2 + x * scale(); }
  function py(y) { return view.size / 2 - y * scale(); }

  function draw() {
    var s = view.size, c = colours();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = c.surface;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    for (var r = 10; r <= 40; r += 10) {
      ctx.beginPath();
      ctx.arc(px(0), py(0), r * scale(), 0, 2 * Math.PI);
      ctx.stroke();
    }

    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.fillText('Rings every 10 nm', 6, s - 6);

    // Approach line and runway
    ctx.strokeStyle = c.link;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(px(-LAND_MAX_DIST), py(0));
    ctx.lineTo(px(-1.5), py(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = c.text;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px(-1.5), py(0));
    ctx.lineTo(px(1.5), py(0));
    ctx.stroke();
    ctx.fillStyle = c.text;
    ctx.fillText('RWY 09', px(2), py(0) - 8);

    state.planes.forEach(function (p) {
      var color = p.warn ? c.danger : c.link;
      var x = px(p.x), y = py(p.y), rad = p.heading * Math.PI / 180;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(rad) * 16, y - Math.cos(rad) * 16);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();

      if (p === state.selected) {
        ctx.strokeStyle = c.text;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, 2 * Math.PI);
        ctx.stroke();
      }

      ctx.fillStyle = p.warn ? c.danger : c.text;
      var label = p.cs + ' ' + Math.round(p.alt) + 'ft ' + Math.round(p.speed) + 'kt' + (p.warn ? ' !' : '');
      var flip = x + 10 + ctx.measureText(label).width > s - 4;
      ctx.textAlign = flip ? 'right' : 'left';
      ctx.fillText(label, flip ? x - 10 : x + 10, y < 20 ? y + 18 : y - 8);
      ctx.textAlign = 'left';
    });

    if (state.conflict) {
      ctx.strokeStyle = c.danger;
      ctx.lineWidth = 3;
      state.conflict.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(px(p.x), py(p.y), 14, 0, 2 * Math.PI);
        ctx.stroke();
      });
    }
  }

  // ----- Page text -----

  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }

  function refreshPanel() {
    setText(scoreEl, String(state.score));
    setText(bestEl, String(state.best));

    state.planes.forEach(function (p) {
      var btn = rows[p.cs];
      if (!btn) {
        var li = document.createElement('li');
        btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-cs', p.cs);
        li.appendChild(btn);
        listEl.appendChild(li);
        rows[p.cs] = btn;
      }
      setText(btn, p.cs + ' — heading ' + pad3(p.heading) + '°, ' + Math.round(p.alt) + ' ft, ' +
        Math.round(p.speed) + ' kt' + (p.warn ? ' — TOO CLOSE' : ''));
      btn.setAttribute('aria-pressed', p === state.selected ? 'true' : 'false');
      btn.className = p.warn ? 'warn' : '';
    });

    setText(selectedEl, state.selected
      ? state.selected.cs + ' is selected.'
      : 'None. Choose one from the list or tap it on the radar.');

    var enabled = !!state.selected && !state.over && !state.paused;
    for (var i = 0; i < controlButtons.length; i++) {
      if (controlButtons[i].disabled === enabled) controlButtons[i].disabled = !enabled;
    }
  }

  // ----- Events -----

  document.getElementById('command-form').addEventListener('submit', function (e) {
    e.preventDefault();
    runCommand(commandInput.value);
    commandInput.value = '';
  });

  document.querySelector('.controls').addEventListener('click', function (e) {
    var action = e.target.getAttribute('data-action');
    if (action) runButton(action);
  });

  listEl.addEventListener('click', function (e) {
    var cs = e.target.getAttribute('data-cs');
    if (cs) state.selected = findPlane(cs);
  });

  canvas.addEventListener('pointerdown', function (e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var best = null, bestDist = 24;
    state.planes.forEach(function (p) {
      var d = Math.hypot(px(p.x) - mx, py(p.y) - my);
      if (d < bestDist) { best = p; bestDist = d; }
    });
    if (best) state.selected = best;
  });

  pauseBtn.addEventListener('click', function () {
    if (state.over) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  });

  document.getElementById('restart').addEventListener('click', reset);
  window.addEventListener('resize', resize);

  // ----- Start -----

  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!state.paused && !state.over) update(dt);
    draw();
    refreshPanel();
    requestAnimationFrame(frame);
  }

  resize();
  reset();
  requestAnimationFrame(frame);
})();
