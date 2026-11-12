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

## Nov 12 changes
- **History & lean is guaranteed on every question.** The database now creates a `baseline` row (5 bullets + lean built from Marqit's own resolved-question history, lean clamped to 30-70) the moment a question is added. A trigger refuses to store a row without a lean or without 5 bullets, and rejecting a draft in admin.html falls back to the baseline instead of blanking the panel. The `draft-insights` function (now hourly) upgrades baseline rows to researched drafts and publishes them straight away; it also gives older rows that only had a baseline lean a real lean from their own bullets. Check `insights_baseline_watch` (service role) to see what is still on baseline. Needs Anthropic API credit to upgrade.
- Closed (collapsed) History & lean panel now shows the lean chip ("Lean YES 55%").
- Play: Submit bar is a bright gold "Submit your 3 calls" when all picks are in, "Pick 2 more to submit" before, and tapping it early jumps to the next unanswered card. Live strip under every open question: lock countdown, points on the line (+200 on 2X days), calls in.
- Player popup (leaderboard, groups, comments): buddy / rival / group / follow tag, "played today" status, Remind button, and the player's latest 5 locked calls (hidden for players who are off the leaderboard). `player_card_extras` RPC. `send_nudge` now also allows people you follow and group-mates (still 1 per sender per day, 5 per player per day).
- Groups: compact layout; "Who still needs to play" with Remind buttons; settings and Leave group tucked under "Group settings". Fixed `get_group_participation_today`, which had never worked (ambiguous column names).
- Marqit+: new **Sharp Feed** (latest locked calls from people you follow, buddies, rivals; `sharp_feed` RPC, gated by `is_marqit_plus()`), rewritten pitch with the hooks first, and a personal "You are X% on N calls" line for non-members.
- Not built (needs a decision): founding-member price lock and badge, shareable pick receipts, member flair on leaderboards.
