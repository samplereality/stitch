# Glitchlet

Glitchlet is a lightweight, browser-based creative-coding environment (HTML/CSS/JS only). Think "Glitch-lite" for shared hosting: students edit multi-file projects in the browser with instant preview, save locally via IndexedDB, and later publish to a class projects folder.

## Highlights

- Multi-file editor with a file tree and live preview
- Local-first persistence (autosave to IndexedDB)
- ZIP import/export for templates and backups
- Static front end (no Node/React required)

## Status

Frontend editor scaffold is in place. Server-side publishing (through a PHP-endpoint) also works.

## Getting started

Option A: open `index.html` directly in your browser.

Option B (recommended): run a tiny local server to avoid browser file access quirks.

```sh
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Install checklist (shared hosting)

- Create a private storage folder outside `public_html` (e.g., `~/private/`).
- Ensure the private folder is writable by PHP (`chmod 755` or `775`, depending on ownership).
- Verify `publish/publish.php` can write to `../private/project_auth.json`.
- Confirm the `/projects` folder exists and is writable by PHP.
- Set `ADMIN_PASSWORD_HASH` in `publish/publish.php` to a real hash.
- Ensure PHP is enabled for the `/publish` folder.

## Project structure

- `index.html` - app shell
- `assets/styles.css` - UI styling
- `assets/app.js` - editor logic, preview rendering, persistence, ZIP flows

## Notes

- ZIP import/export uses JSZip from a CDN by default. If you need fully offline hosting, download JSZip locally and update `ensureJSZip()` in `assets/app.js`.

## Roadmap

- PHP publishing endpoint + token auth
- Project manager (list, rename, delete)
- Instructor template catalog

## License

MIT. See `LICENSE`.
