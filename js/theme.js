// Light is the default; the visitor's choice is remembered when storage is available.
(function () {
  var theme = 'light';
  try { theme = localStorage.getItem('theme') || 'light'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('theme-toggle');
    if (!button) return;

    function show() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      button.textContent = dark ? 'Switch to light theme' : 'Switch to dark theme';
    }

    button.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      show();
    });
    show();
  });
})();
