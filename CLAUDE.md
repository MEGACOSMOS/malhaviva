# Curoflow Site

## Rules — read `AGENTS.md` first

`AGENTS.md`, at the root of the repository, holds rules that are **not
optional** and apply to every change, whether or not the user mentions
them. Read it before touching `public/annotations.mjs` or adding anything
to the map.

The one that is broken most often, stated here so it cannot be missed:

> **Every new annotation must be reachable by someone who cannot see the
> screen.** A new testimony, stop, or map point is not finished until it
> has a spoken name in `nomeAcessivel()` ("Testemunho de Dulce", not
> "Dulce"), that name translated in all four languages in
> `public/idiomas.js`, `role="button"` with `tabindex="0"`, and
> `aria-hidden`/`tabindex="-1"` while it is off screen. `AGENTS.md` has the
> detail and a ten-second way to check it.

## Project Overview

This is a React website deployed on Cloudflare Workers.

## User Context

The user is **non-technical** and is focused on the visual design and content of the site. They have no knowledge of the underlying implementation. Keep this in mind at all times:

- Never use technical jargon without explanation. Prefer plain language.
- Never ask the user to run terminal commands, install dependencies, edit config files, or make code changes themselves. Handle all of that silently.
- When something breaks, fix it yourself. Don't explain stack traces or error messages — just describe what went wrong in simple terms and what you're doing to fix it.
- When presenting choices, frame them visually ("Do you want the header to be sticky or scroll with the page?") rather than technically ("Should I use `position: fixed` or `position: relative`?").
- Focus responses on what things **look like** and **do**, not how they're implemented.

## Tech Stack

- **Runtime / Package Manager:** Bun (always use `bun` instead of `npm`/`yarn`/`npx`)
- **Framework:** React
- **Deployment:** Cloudflare Workers
- **Styling:** Tailwind CSS

## Development Server

- Start the dev server with `bun run dev`. It is configured to run on **port 8000**.
- When the server is started or restarted, tell the user: **"The site is running at http://localhost:8000 — open that in your browser to see the changes."**
- Keep the server running while iterating. If it stops for any reason, restart it automatically.
- The site uses Vite with hot module replacement — most changes appear instantly without a refresh.

## Git & Commits

- **Commit early and often.** After every meaningful change (new section added, style updated, bug fixed), create a commit immediately. Do not batch multiple unrelated changes.
- Use clear, simple commit messages that describe what changed visually (e.g., "Add hero section with background image", "Change nav bar color to blue").
- Never ask the user whether to commit — just do it.
- Always push after committing.

## Workflow Guidelines

- When the user asks for a change, make the change, commit it, and confirm what you did in plain language.
- If the user asks to "undo" or "go back," use git to revert to the previous commit and explain what was restored.
- When adding new pages or sections, give the user a brief description of what was added and remind them to refresh their browser if needed.
- Proactively suggest visual improvements or next steps when appropriate (e.g., "The homepage is looking good — would you like to add an About page next?").
- If a dependency needs to be installed, do it silently and only mention it if something goes wrong.
```