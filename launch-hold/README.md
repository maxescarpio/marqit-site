# Free mail-in entry (AMOE): held back until the rules are approved

Nothing in this folder is deployed. `.assetsignore` keeps `launch-hold/` off the live site.

`free-entry.html` is the public page. The yellow `[...]` pieces are placeholders that need the real
prize, dates, mailing address, eligible states, drawing name and a link to the official rules.
Your lawyer writes the rules; the page only summarizes them.

## To go live (in this order)
1. Lawyer approves the official rules and the structure of the giveaway.
2. Fill every yellow placeholder in `free-entry.html`.
3. Run `supabase/launch/20261104_amoe_mail_in_entries_LAUNCH.sql` in the Supabase SQL editor.
4. Move the page to the site root: `git mv launch-hold/free-entry.html free-entry.html`, and remove `<meta name="robots" content="noindex">`.
5. Add a link to it (footer in `index.html`, next to Terms), and update the site lines that say
   "no cash prizes" (index.html about section, terms.html) and "playing earns no entries" (plus.js).
6. In the admin, open the Giveaway tab, create the drawing, and log each card as it arrives. The pool shown there is valid mail-in cards plus Marqit+ members subscribed at that moment, one entry each.
7. Before launch: update what Stripe was told (support thread of Nov 2). It says Marqit+ gives no entry; this structure enters members automatically.
