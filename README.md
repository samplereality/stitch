# Glitchlet

Glitchlet is a lightweight, browser-based creative-coding environment (HTML/CSS/JS only). Think "Glitch-lite" for shared hosting: students edit multi-file projects in the browser with instant preview, save locally via IndexedDB, and later publish to a class projects folder.

## Highlights

- Multi-file editor with a file tree and live preview
- Local-first persistence (autosave to IndexedDB)
- ZIP import/export for templates and backups
- Static front end (no Node/React required)

## Status

Frontend editor scaffold is in place. Server-side publishing (through a PHP-endpoint) also works.

## Getting started (shared hosting)

These instructions assume a typical shared host (e.g., Reclaim Hosting) with PHP enabled.

1) Create a subdomain in your hosting control panel (e.g., `glitchlet.yoursite.net`).
2) Upload the project files into the subdomain document root (e.g., `~/glitchlet.yoursite.net/`).
3) Create a `/projects` directory inside that document root.
4) Configure a MySQL database and run `publish/schema.sql`.
5) Set DB credentials and app URLs in `publish/config.php` (or via env vars).
6) Set `GLITCHLET_BOOTSTRAP_TOKEN` and create the first manager via `/publish/bootstrap.php?token=...`.
7) Confirm PHP is enabled for the `/publish` folder (a simple `test.php` should run).
8) Open the app at your subdomain, sign in, and publish a test project.

## Local development (optional)

If you want to run it locally:

```sh
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Install checklist (shared hosting)

- Create a MySQL database and user.
- Run `publish/schema.sql` against the database.
- Confirm the `/projects` folder exists and is writable by PHP.
- Set DB creds + `GLITCHLET_BOOTSTRAP_TOKEN` in `publish/config.php` or environment variables.
- Create the manager account via `/publish/bootstrap.php?token=...`.
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
