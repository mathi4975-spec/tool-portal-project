# CLAUDE.md

## Tech Stack
- Plain HTML, CSS, and JavaScript only.
- No frameworks, no build step: files open directly in a browser.

## Project Structure
- `index.html` — portal homepage (one card per tool)
- `tools/<tool-name>/index.html` — one folder per tool; currently `tools/radar/` (ATC Radar Simulator)
- `css/base.css` — shared styles and theme colours; `css/radar.css` — radar page only
- `js/theme.js` — light/dark toggle; `js/radar.js` — radar game
- `README.md` — project readme; `CLAUDE.md` — this file

Keep each tool's own files named after the tool, and update this section when files are added.

## Visual Design
"Flight Strip" look, chosen from three options:
- Fonts: JetBrains Mono for headings and buttons, IBM Plex Sans for body text (loaded from Google Fonts, with system fallbacks).
- Square corners and 2px outlines.
- Colours are CSS variables at the top of `css/base.css`, for both themes. Change colours there, not in individual pages.
- The radar screen stays dark in both themes.

## Key Requirements
1. Every page must be responsive and work on desktop, tablet and phone.
2. Users can toggle between a light and a dark theme. The default is the light theme.
3. Text must stay easy to read, with good contrast, in both the light and the dark theme.

## Rules for Claude
- Explain technical terms in plain language.
- Ask before making big changes.
- Ask rather than guess.

## Feature Plan
A web portal where tertiary students try small aviation tools in the browser.

### Portal structure
- **Homepage** (`index.html`): short intro plus a card for each tool.
- **Opening a tool:** the visitor clicks a tool's card, which opens that tool's own page in `tools/<tool-name>/`.
- **Getting back:** every page has a header with a "Home" link and the theme toggle.
- **Adding a tool later:** create a new folder `tools/<tool-name>/` with its own page, then add one card to the homepage. No other pages need to change.

### Phases
1. **Phase 1: portal plus first tool.** The homepage, theme toggle, and one tool: the ATC Radar Simulator, a controller game (type commands, keep planes apart, land them, get a score).
   - [x] Step 1: portal homepage with a placeholder "Tool 1 — coming soon" card that opens and returns via the Home link.
   - [x] Step 2: the ATC Radar Simulator itself, in `tools/radar/` (replaces the placeholder).
2. **Phase 2: more tools.** Add further aviation tools, one at a time.
3. **Phase 3: polish.** Improve the look, helpful hints and accessibility as needed.
