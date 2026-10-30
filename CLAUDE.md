# CLAUDE.md

## Tech Stack
- Plain HTML, CSS, and JavaScript only.
- No frameworks, no build step: files open directly in a browser.

## Project Structure
Nearly empty for now. Currently only:
- `README.md` — project readme
- `CLAUDE.md` — this file

Add new files at the top level or in simple folders (e.g. `css/`, `js/`) and update this section when they appear.

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
2. **Phase 2: more tools.** Add further aviation tools, one at a time.
3. **Phase 3: polish.** Improve the look, helpful hints and accessibility as needed.
