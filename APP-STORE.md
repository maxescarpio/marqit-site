# Marqit app: store submission kit

Bundle ID: `com.playmarqit.app`. The app loads https://playmarqit.com inside a native shell (Capacitor), so site updates go live without a new app review.

## Build
`npm install`, then `npm run app:ios` (Xcode) or `npm run app:android` (Android Studio).
iOS: set Team under Signing & Capabilities, add the Push Notifications capability, then Product > Archive.
Android: Build > Generate Signed Bundle (AAB). Add google-services.json (Firebase) before building if you want push.

## Store listing

**Name:** Marqit: Daily Predictions
**Subtitle (iOS, 30 chars):** Call the day's 3 big stories
**Short description (Android, 80 chars):** Free daily prediction game. Make 3 calls a day, same 3 worldwide.

**Full description:**
Marqit is a free daily prediction game. Every day there are three big stories and three calls to make. Everyone in the world gets the same three, so you can see exactly where you stand.

- Make your 3 calls before they lock
- See where the crowd landed once you have called it
- Build a streak and climb the leaderboards
- Challenge friends and groups, and send a friendly reminder
- Share your record with a verified link

No money, no odds, no betting. Marqit never holds money or settles anything. It is just you, your judgment and a streak to protect.

**Keywords (iOS, 100 chars):** predictions,daily game,news,streak,trivia,forecast,leaderboard,friends,quiz,calls
**Category:** Games > Trivia (alternative: News)
**Age rating:** 12+ / Teen is safest; the questions cover news, sports and entertainment. Answer the rating questionnaire "none" for gambling (no real or simulated gambling, no stakes).
**Support URL:** https://playmarqit.com
**Privacy policy URL:** https://playmarqit.com/privacy
**Terms URL:** https://playmarqit.com/terms
**Support email:** help@playmarqit.com
**What's new (v1.0):** First release of the Marqit app. Make your daily calls, track your streak and challenge friends.

## Privacy answers (based on privacy.html and the code)

**Apple App Privacy labels**
- Contact info: email address. Linked to user, used for app functionality. Not for tracking.
- Identifiers: user ID, device token for push. Linked to user, app functionality.
- User content: predictions and picks. Linked to user, app functionality.
- Usage data: product interaction (Google Analytics tag + internal events). Linked or not linked, analytics.
- Other data: state, age confirmation. Linked to user, app functionality.
- Tracking: **No** (no advertising IDs, no cross-site tracking, data is not sold). If you keep Google Analytics, still answer analytics only, not tracking.
- Purchases (Marqit+ via Stripe): see the warning below.

**Google Play Data safety**
- Collected: email, user IDs, app interactions, device or other IDs (push token), approximate location (state, self-reported, optional).
- Shared with third parties: no (processors only: Supabase, Cloudflare, Google Analytics).
- Encrypted in transit: yes. Users can request deletion: yes (help@playmarqit.com). Add an in-app or web deletion link too: Google requires a URL.
- Target audience: 13+, not a children's app. Ads: none.

## Things that can get the app rejected (fix before submitting)
1. **Marqit+ with Stripe.** Apple requires in-app purchase for digital subscriptions sold inside an iOS app (guideline 3.1.1) and takes 15-30%. Easiest fix: hide the Marqit+ upgrade UI in the iOS app (members who subscribed on the web still keep access). Google has a similar rule for Android.
2. **Google sign-in.** Google blocks sign-in inside embedded web views, and Apple (4.8) wants Sign in with Apple if you offer Google. Easiest fix: show only email + code login in the app.
3. **Account deletion.** Apple requires deleting an account from inside the app (5.1.1). Add a Delete account button to Settings that calls a Supabase delete function.
4. **Native value (4.2).** Share sheet, haptics and push are included; push needs the Apple push key (paid account) and Firebase for Android.
