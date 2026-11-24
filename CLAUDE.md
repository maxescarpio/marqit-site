# Notes for Claude (standing instructions from the owner)

## Shipping changes
- Never ask the owner to open, click or merge a pull request. They do not want to merge anything themselves, ever.
- When a change is ready, commit it and push straight to `main` (fetch first; if `main` moved, rebase onto it, then push). Cloudflare deploys `main` automatically.
- Then check the live site (https://playmarqit.com) and report what you saw. Keep the report short.
- Only stop and ask first if a change can't be undone or could reasonably go two ways (for example anything that changes the sweepstakes rules, prizes, or money).

## How the owner likes to work
- Short replies. No long write-ups.
- Do the work yourself with the tools connected; don't hand steps back to the owner unless they truly need their own sign-in (for example Google Search Console login or a DNS record).

## Site basics
- Static site on Cloudflare (`wrangler.jsonc`), `app.js` renders the game in the browser.
- `index.html` loads `app.min.js`, a minified copy of `app.js`. After ANY edit to `app.js`, rebuild it with `scripts/minify.sh` and bump the `?v=` on its script tag, or the change won't reach players.
- Use clean URLs without `.html` (`/how-to-play`, `/privacy`, `/terms`, `/ambassador`) in canonicals, sitemap and links.
- Internal tool pages stay noindex (`/post`, `/video`, `/howto`, `admin`, `widget`, etc.).
- `launch-hold/` holds sweepstakes pages that are not live yet. Do not publish them without the owner's say-so.
