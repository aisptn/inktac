# InkTAC — Pure HTML, CSS, & Vanilla JS Image Channel Analyzer

A zero-framework, zero-build-tool web application for image pixel summation and total area coverage (TAC) analysis across RGBA (0%–100%) and CMYK (0%–400%) color profiles.

## Architecture

This project is built strictly with **pure, standard web technologies**:
- **HTML**: `index.html` (Native DOM elements)
- **CSS**: `style.css` (Pure CSS, custom variables, responsive grid)
- **JavaScript**: `js/app.js`, `js/iccParser.js`, `js/sampleImages.js` (Pure ES6+ modules using native Canvas 2D and DataView APIs)

**No frameworks (no React, Vue, Svelte, or Angular), no TypeScript compiler, and no CSS preprocessors required.**

## How to Run

### Option 1: Open Directly in Any Browser
You can open `index.html` using any local static web server (such as Python's built-in server or VS Code Live Server):

```bash
# Python 3:
python3 -m http.server 8000

# or Node.js npx:
npx serve .
```

Then visit `http://localhost:8000`.

### Option 2: Deploy to GitHub Pages / Any Static Host
Push these files to GitHub Pages, Cloudflare Pages, Netlify, or any Apache/Nginx web server. It works immediately without any build step.
