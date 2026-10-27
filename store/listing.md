# Ore Drift: Google Play listing drafts

Items marked **VERIFY** are things I could not confirm from the code or from Google's current rules. Check them in Play Console before you submit.

## App details
- Name: **Ore Drift** (VERIFY: search Google Play for an existing app with the same or a confusingly close name)
- Category: Game, Casual (or Simulation)
- Free to play, with ads (banner plus optional rewarded ads) and optional in-app purchases

## Short description (80 characters max)
Pick one. Lengths are checked.

1. `Tap an asteroid, hire miners, catch comets, and build a mining empire.` (70)
2. `Space mining idle clicker: hire miners, upgrade, and relocate to richer belts.` (78)
3. `Mine ore, catch comets, finish daily missions and relocate to richer belts.` (75)
4. `A calm space-mining idle game. Tap, hire miners, catch comets, move belts.` (74)

## Full description (about 1,700 of 4,000 characters)

Tap a glowing asteroid and start mining. Hire drones, laser rigs and orbital foundries to dig while you are away, then move on to richer belts for permanent bonuses.

**What you do**
- Tap the asteroid to mine ore. Every tap counts.
- Hire seven kinds of automatic miners, from a small Mining Drone to a Stellar Collector. Each one doubles its output when you own 10, 25, 50, 100, 150 and 200 of it.
- Install nine upgrades that boost taps and your whole fleet.
- Catch passing comets for a burst of x7 output or a cargo pod of ore.
- Collect a daily supply drop. Come back on consecutive days for bigger rewards, up to two and a half times the base.
- Finish three new daily missions, then open the daily cache.
- Earn 32 commendations. Each one adds a permanent +1% to everything.
- Relocate to a new belt to earn survey points. Each point adds +10% to all output and taps, and you keep them forever.

**Made to fit your day**
- Your fleet keeps mining while the app is closed, up to 8 hours at half rate.
- Plays offline. No account and no sign-in. Ads and the shop need an internet connection.
- Optional reminders when your supply drop is ready, your hold is full or your cargo pod is ready. They are off until you turn them on.
- Free to play with ads. A one-time "Remove ads" purchase removes the banner and makes the ad bonuses free.
- Optional shop: ore packs, a one-time starter bundle and a permanent +25% boost. Nothing random, and nothing is required to progress.
- Portrait play with large touch targets, sound and vibration you can switch off, and reduced motion support.

Ore Drift is a slow, steady idle game. Check in for a minute, spend your ore, and let the belt do the rest.

## Graphics (in this folder)
- App icon 512x512: `store/icon-512.png`
- Feature graphic 1024x500: `store/feature-graphic-1024x500.png`
- Both are placeholders drawn for this project. Replace them with art you prefer.

## Screenshots to capture
Take them from the real app on a phone, in portrait. Play Console needs at least 2 phone screenshots (up to 8). VERIFY the current size rules in Play Console. At the time of writing: JPEG or 24-bit PNG, each side between 320 and 3,840 px, long side at most twice the short side. A normal phone screenshot (for example 1080x2400) qualifies.

Suggested set, in this order:
1. Fleet tab with a few vessels owned, ships orbiting, and a floating `+` number
2. A comet on screen with the x7 frenzy pill active and veins glowing
3. Upgrades tab with several upgrades available
4. Goals tab: supply streak squares and daily missions
5. Goals tab scrolled to commendations with progress bars
6. Belt tab showing survey points and the Relocate button

Tips: use a mid-game save so the screens are not empty, and turn on do-not-disturb so no notification bars appear.

## Data safety form (draft answers)
The game itself has no account and sends nothing to the developer. Google AdMob (ads) and Google Play (purchases) are third-party SDKs and must be declared. Fill in the form from Google's own guidance, because the exact data types change. My starting point:
- Does your app collect or share any of the required user data types? **Yes** (through the AdMob SDK)
- Data types to expect for AdMob (VERIFY against Google's current "AdMob and Play Data safety" guidance): **Device or other IDs** (advertising ID), and possibly **App info and performance** and **Approximate location** (derived from IP). Purposes: **Advertising or marketing**, **Analytics** (ad measurement), **Fraud prevention, security, and compliance**. These are shared with Google as a service provider.
- Purchases: Google Play handles payment. VERIFY whether you need to declare purchase history. In most cases Play Billing data is not declared by the app, but check the current rule.
- Is all data encrypted in transit? Yes (the AdMob and Play Billing SDKs use HTTPS). VERIFY.
- Can users request deletion? The game keeps no server-side data. Players can wipe the save in Settings or uninstall. Data held by Google is managed through the Google account.
- Privacy policy URL: `https://al-creado.github.io/OreDrift/` (hosted from `docs/index.html`). It already describes ads, purchases and backup.
- VERIFY: the manifest has `allowBackup="true"`, so Android Auto Backup may copy the save to the player's Google account. The policy says so. Check Google's current guidance on whether OS-level backup counts as "collected". If you want to avoid the question, set `android:allowBackup="false"` in `AndroidManifest.xml` (players then lose progress when changing phones).
- Any later change to ads, analytics or purchases means updating this form and the policy before you release.

## Content rating questionnaire (draft answers)
Category: Game. Expect a low rating (everyone). Answer honestly in the questionnaire. My reading of the game:
- Violence: no
- Blood or gore: no
- Sexual content or nudity: no
- Profanity or crude humour: no
- Controlled substances (drugs, alcohol, tobacco): no
- Gambling or simulated gambling: no. Comets give random rewards, but nothing is paid for. Paid shop items have fixed, visible rewards and nothing random is sold.
- User-generated content or user-to-user communication: no
- Shares the user's location or personal information: no
- Digital purchases: **yes** (in-app purchases), and the app contains ads. Answer the ads and purchases questions accordingly.
- VERIFY: the exact question wording and categories change. Answer from the game's real behaviour, not from this list.

## Target audience and content
- Suggested target age: **13 and older** (or "18 and older"). This avoids the extra Families policy rules that apply when children are a target audience. VERIFY the current Families policy before choosing a younger group.
- Is the app appealing to children? An idle clicker with cartoon-free space art is not aimed at children, but answer for yourself.

## Ads declaration
- Contains ads: **Yes** (AdMob banner and optional rewarded ads)
- Advertising ID declaration (App content): **Yes**, used for advertising. The ads SDK adds the AD_ID permission automatically.
- Target audience must NOT include children under 13 while the app shows AdMob ads (that would trigger Play's Families ads rules). Keep the 13+ choice above.

## Other app content questions
- News app: no
- COVID-19 contact tracing or status app: no
- Government app: no
- Financial features: no
- Health features: no

## Permissions the app asks for (for your reference)
From the merged Android manifest:
- `VIBRATE`: haptic feedback on taps (normal permission, no prompt)
- `POST_NOTIFICATIONS`: only requested when the player turns on Reminders in Settings
- `RECEIVE_BOOT_COMPLETED` and `WAKE_LOCK`: added by the notifications plugin so scheduled reminders survive a restart
- `INTERNET` and `ACCESS_NETWORK_STATE`: used by AdMob and Google Play Billing
- `com.google.android.gms.permission.AD_ID`: added by the ads SDK (advertising ID)
- `com.android.vending.BILLING`: added by the billing library for in-app purchases
- `SCHEDULE_EXACT_ALARM` is removed in the manifest because reminders do not need it

## Testing track reminder
For a new personal account (created after 13 Nov 2023): closed test with at least 12 testers opted in for 14 days in a row before you can apply for production. VERIFY the current rule in Play Console Help.

## In-app products to create in Play Console
Monetize with Play, then Products, then One-time products. Create each with exactly this ID, set a price, and activate it. All six are one-time products (the app consumes the three ore packs after delivering them so they can be bought again).

| Product ID | Name | Type in the app | Suggested price (your call) |
|---|---|---|---|
| `remove_ads` | Remove ads | bought once, restorable | 2.99 to 3.99 USD |
| `starter_bundle` | Starter bundle | bought once, restorable | 1.99 USD |
| `boost_25` | Prospector boost | bought once, restorable | 3.99 USD |
| `ore_small` | Small ore pack | repeatable | 0.99 USD |
| `ore_medium` | Medium ore pack | repeatable | 2.99 USD |
| `ore_large` | Large ore pack | repeatable | 7.99 USD |

Notes:
- Product IDs cannot be changed or reused after creation. They are defined in `src/data.js` (PRODUCTS).
- Play shows each price in the player's currency; the app displays whatever Play returns.
- You need a payments profile in Play Console before you can sell anything.
- VERIFY the current Play rules for one-time products and for refunds. The app grants items only once per purchase and acknowledges purchases itself.
- To test purchases: upload a build to the internal or closed testing track, add your Google account under License testing (Play Console, Settings), and install from the testing link. Purchases will not work from a plain Android Studio debug install of a build Play has never seen.

## Before you release with ads and the shop
1. In `src/ads.js` set `ADS_TESTING = false` and fill in `REWARDED_AD_UNIT_ID` and `BANNER_AD_UNIT_ID` from your AdMob account.
2. In `android/app/src/main/res/values/strings.xml` replace the test `admob_app_id` with your real AdMob app ID. This is a separate place from the ad unit IDs.
3. In AdMob, create the app and the two ad units (banner and rewarded). Set the ad content rating and blocking you want. Set up the consent message (Privacy and messaging, European regulations) so the consent form can appear in the EEA and UK.
4. Never tap your own live ads. Use test ads (the app does until you flip `ADS_TESTING`) or register your phone as a test device.
5. Check the banner on a real phone: it should sit under the tab bar without covering it.
