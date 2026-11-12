# Ore Drift: Google Play listing drafts

Items marked **VERIFY** are things I could not confirm from the code or from Google's current rules. Check them in Play Console before you submit.

Status (Nov 2026, version 0.5.0, code 8): the app is in closed testing. The Shop tab and Play Billing are **switched off** (`SHOP_ENABLED = false` in `src/main.js`), so the build contains ads but sells nothing yet. The live AdMob IDs are in the code.

## App details
- Name: **Ore Drift** (VERIFY: search Google Play for an existing app with the same or a confusingly close name)
- Category: Game, Casual (or Simulation)
- Free to play, with ads (banner plus optional rewarded ads). Optional in-app purchases are built but switched off for now.

## Short description (80 characters max)
Pick one. Lengths are checked. Number 4 is the suggested one.

1. `Tap an asteroid, hire miners, catch comets, and build a mining empire.` (70)
2. `Space mining idle clicker: hire miners, upgrade, and relocate to richer belts.` (78)
3. `Mine ore, catch comets, finish daily missions and relocate to richer belts.` (75)
4. `A calm space-mining idle game. Tap, hire miners, catch comets, move belts.` (74)

## Full description (about 2,000 of 4,000 characters)

Plain text on purpose: Play does not show Markdown, so asterisks would appear as asterisks. Update the upgrade count if you add content. Do not put the number of commendations here: the game hides the total (and the secret ones) on purpose, and add a line about purchases when the shop is switched on.

```
Tap a glowing asteroid and start mining. Hire drones, laser rigs and orbital foundries to dig while you are away, then move on to richer belts for permanent bonuses.

WHAT YOU DO
• Tap the asteroid to mine ore. Every tap counts.
• Hire seven kinds of automatic miners, from a small Mining Drone to a Stellar Collector. Each one doubles its output at 10, 25, 50, 100, 150 and 200 owned.
• Install fifteen upgrades that boost your taps and your whole fleet.
• Catch passing supply ships for a temporary x7 output boost, and comets for a random pile of ore. Watch for something rarer, too.
• Collect a daily supply drop. Come back on consecutive days for bigger rewards.
• Finish daily and weekly missions, swap the ones you don't like, then open the daily cache.
• Join weekly events that send more comets and supply ships your way.
• Earn commendations from Bronze to Platinum and rise in rank from Rookie to Legend.
• Read the Captain's journal, a story of the Drift that unlocks chapter by chapter.
• Relocate to a new belt for a permanent bonus to all output and taps, plus a survey point to spend. The more you mined, the bigger the bonus.
• Spend survey points on skins for your asteroid, your fleet and the sky, and earn exclusive ones by keeping a daily streak. They only change the look, so your bonus never goes down.
• A few hidden surprises are waiting for sharp-eyed captains.

MADE TO FIT YOUR DAY
• Your fleet keeps mining while the app is closed, at half speed for up to 8 hours.
• A welcome-back summary shows what you earned while away.
• Plays offline. No account and no sign-in.
• Optional reminders when your supply drop, full hold or cargo pod is ready.
• A short how-to-play for new captains, large touch targets, and calm ambient music. Music, sound effects and vibration can each be switched off.
• Free to play with ads: a small banner at the bottom, plus optional rewarded ads for bonus rewards.

Ore Drift is a slow, steady idle game. Check in for a minute, spend your ore, and let the belt do the rest.
```

## Graphics (in this folder)
- App icon 512x512: `store/icon-512.png`
- Feature graphic 1024x500: `store/feature-graphic-1024x500.png` (RGB, no transparency, as Play requires)
- Product icons (one per in-app product, 1024x1024, kept inside the hexagon crop Play uses): `store/product-icons/`
- Phone screenshots: `store/screenshots/` (see its README). Use the captioned set in `phone/` (1080x1920) or the plain set in `plain/`.
- Retake the screenshots when the look of the game changes. Play Console: Grow users > Store presence > Main store listing > Graphics.

## Data safety form
The game itself has no account and sends nothing to the developer. Google AdMob (ads) is a third-party SDK and must be declared. Google Play handles purchases. Fill in the form from Google's own guidance, because the exact data types change.

What was entered (Nov 2026):
- Does the app collect or share any of the required user data types? **Yes** (through the AdMob SDK).
- Collected **and** shared, not processed ephemerally, collection required:

| Data type | Purposes |
|---|---|
| Approximate location (from the IP address) | Advertising or marketing, Fraud prevention |
| App interactions (ad views and taps) | Advertising or marketing, Analytics |
| Crash logs | Analytics, Fraud prevention |
| Diagnostics | Analytics, Fraud prevention |
| Device or other IDs (advertising ID) | Advertising or marketing, Analytics, Fraud prevention |

- Account creation: the app does not allow users to create an account, and has no login. Deletion requests: **No** (the game keeps no server-side data; players can wipe the save in Settings or uninstall; data held by Google is managed in the Google account).
- Encrypted in transit: **Yes** (the AdMob SDK uses HTTPS).
- Purchases: Play Billing data is not declared by the app. VERIFY against the current rule when the shop is switched on.
- Advertising ID declaration (App content): **Yes**, used for advertising. The ads SDK adds the `AD_ID` permission automatically.
- Privacy policy URL: `https://al-creado.github.io/OreDrift/` (hosted from `docs/index.html`). The same text is shown inside the app (Settings > Privacy policy), built from that one file.
- VERIFY: the manifest has `allowBackup="true"`, so Android Auto Backup may copy the save to the player's Google account. The policy says so. Check Google's current guidance on whether OS-level backup counts as "collected". If you want to avoid the question, set `android:allowBackup="false"` in `AndroidManifest.xml` (players then lose progress when changing phones).
- Any later change to ads, analytics or purchases means updating this form and the policy before you release.

## Content rating questionnaire (draft answers)
Category: Game. Expect a low rating (everyone). Answer honestly in the questionnaire. My reading of the game:
- Violence: no
- Blood or gore: no
- Sexual content or nudity: no
- Profanity or crude humour: no
- Controlled substances (drugs, alcohol, tobacco): no
- Gambling or simulated gambling: no. Comets and the rare rubber duck give random rewards, but nothing is paid for. Shop items (when switched on) have fixed, visible rewards and nothing random is sold.
- User-generated content or user-to-user communication: no
- Shares the user's location or personal information: no
- Digital purchases: **no while the shop is switched off**, **yes** once it is on (change the answer then). The app contains ads either way.
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
For a new personal account (created after 13 Nov 2023): closed test with at least 12 testers opted in for 14 days in a row before you can apply for production. The Dashboard in Play Console shows the count (1 opted in at the last check) and the Apply button once it is met. Testers must open the opt-in link, tap Become a tester and install from the Play Store; inviting is not enough. VERIFY the current rule in Play Console Help.

## In-app products (built, switched off)
The Shop tab and Play Billing are off until the app can sell for real. To turn them on: set `SHOP_ENABLED = true` in `src/main.js`, make sure all six products below are **Active** in Play Console (the Products list shows 1 active purchase option for each), then rebuild and upload. Answer **Yes** to the digital purchases question in the content rating and the in-app purchases declaration, and add a line about purchases to the description.

Monetize with Play, then Products, then One-time products. Create each with exactly this ID, give it one **Buy** purchase option (option ID `buy`, no tags), set a price, add the icon, and activate it. The description needs at least 50 characters. All six are one-time products (the app consumes the three ore packs after delivering them so they can be bought again).

| Product ID | Name | Description | Icon | Suggested price (your call) |
|---|---|---|---|---|
| `remove_ads` | Remove ads | Removes the banner ad for good. Optional bonus ads, such as double offline earnings and the cargo pod, become free. | `remove_ads.png` | 2.99 USD |
| `starter_bundle` | Starter bundle | A one-time boost: 3 hours of ore plus x7 output for 2 minutes. Great for a faster start. | `starter_bundle.png` | 1.99 USD |
| `boost_25` | Prospector boost | A permanent +25% to all ore output and taps. It stays with you through every relocation. | `boost_25.png` | 3.99 USD |
| `ore_small` | Small ore pack | Instantly adds 1 hour of your current ore output to your hold. | `ore_small.png` | 0.99 USD |
| `ore_medium` | Medium ore pack | Instantly adds 6 hours of your current ore output to your hold. | `ore_medium.png` | 2.99 USD |
| `ore_large` | Large ore pack | Instantly adds 24 hours of your current ore output to your hold. | `ore_large.png` | 7.99 USD |

Icons are in `store/product-icons/`. A pack pays its hours of output but never less than a minimum (2,000 / 15,000 / 80,000 t), so it is worth something to a new player too.

Notes:
- Product IDs cannot be changed or reused after creation. They are defined in `src/data.js` (PRODUCTS).
- Play shows each price in the player's currency; the app displays whatever Play returns. Set one base price and let Play convert it, then edit single countries if needed.
- You need a payments profile in Play Console before you can sell anything.
- VERIFY the current Play rules for one-time products and for refunds. The app grants items only once per purchase and acknowledges purchases itself.
- To test purchases: upload a build to the internal or closed testing track, add your Google account under License testing (Play Console, Settings), and install from the testing link. Purchases will not work from a plain Android Studio debug install of a build Play has never seen. Licence-tester purchases are test orders and charge nothing.
- Where sales appear: Order management (if your console shows it) and Financial reports > Revenue.

## Before each release
1. Ads: the live AdMob ad units and app ID are already in the code (`ADS_TESTING = false`, `strings.xml`). Never tap your own live ads. Use `ADS_TESTING = true` for test builds, or register your phone as a test device in AdMob.
2. In AdMob, set up the consent message (Privacy and messaging, European regulations) so the consent form can appear in the EEA and UK, and link the app to its Play listing once it is public.
3. Version: raise `versionCode` in `android/app/build.gradle` (it can never repeat), and keep `versionName` and the `package.json` version in step (Settings shows the `package.json` one).
4. Check the banner on a real phone: it should sit under the tab bar without covering it.
5. Update the descriptions and screenshots if the game changed, and the declarations if ads, data or purchases changed.
