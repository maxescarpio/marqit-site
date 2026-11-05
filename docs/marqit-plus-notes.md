# Marqit+ planning notes (not legal advice; attorney review needed before launch)

## Decisions so far
- Marqit+ is free to every signed-in user for now. The single gate is `is_marqit_plus()` in Supabase.
- Subscription later: ~$10/month AND a yearly option.
- Marqit+ sells information, tools and status only. It must never add entries, points, prizes or scoring advantage.
- "Always ad-free" is a Marqit+ promise. There are no ads today. When ads exist, ad slots must skip members.
- Do NOT write new privacy policy or terms yet; the subscription is not launching.

## Prize / free-entry model (leaning)
- Random drawing among all eligible players, $100 weekly, 18+.
- 1 entry per day for submitting all three picks (participation only, never accuracy, because Marqit+ helps accuracy).
- Free entry route (AMOE) modeled on shopgfp.com/pages/amoe: online form, handwritten 3x5 card (date, giveaway name, name, DOB, address, signature), one claim per day, hard deadline. NO driver's license photo; verify ID only at the winner stage.
- Open for attorney: Rhode Island ($500 threshold), NY/FL registration if totals grow, tax forms if prizes grow, final eligible states.

## Before launching the subscription (to do)
1. Payment processor: Stripe and Paddle both prohibit "sweepstakes and contests" and "sports forecasting or odds-making" with a monetary or material prize. Ask in writing / use a high-risk provider. Disclose the prize truthfully when applying.
2. Clear disclosure of price, billing frequency (monthly and yearly), and auto-renewal before purchase.
3. Easy cancellation, as easy as signing up. Consider renewal reminder emails (required in some states).
4. Sales tax on digital subscriptions (some states tax them; seller may have to collect past a sales threshold).
5. Member check replacing `auth.uid() is not null` in `is_marqit_plus()`.
6. New terms/privacy covering the subscription (after the decisions above).
7. Attorney review of everything above.

## Perks built (Nov 2)
- Marqit+ tab (plus.js), similar past questions, results explained, game/event leans (event_insights), report requests (2/week since Nov 3), My Stats Pro, archive (free = 7 days), My Teams (highlight only), head-to-head, calendar .ics, pick export.
- Morning brief email (edge function morning-brief, cron 12:30 UTC, opt-in via profiles.notify_morning_brief). Weekly recap email already existed (free and paid).
- Gates to change when payments exist: is_marqit_plus() in the database, and the recipient filter in morning-brief.
- Not built yet: stats by team, bigger private groups, priority support, ad-slot member skip (no ads exist yet).

## Nov 3 changes
- Report requests limit is now 2 per week (Mon-Sun ET). Coming-soon perks (bigger private groups, priority support) removed from the Marqit+ page until they exist.
- "Lead with" picker removed; the Play tab now leads with the player's best category by accuracy % (3+ settled picks needed), cached in localStorage and mirrored to profiles.favorite_category.
- Waitlist switch replaced by a button; public count shows once 25+ players are on the list (marqit_plus_waitlist_public_count).
- New stylesheet redesign.css (rankings tabs, date strip, request box, Marqit+ page, similar past questions).
