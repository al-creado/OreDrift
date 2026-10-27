# Ore Drift: Google Play listing drafts

Items marked **VERIFY** are things I could not confirm from the code or from Google's current rules. Check them in Play Console before you submit.

## App details
- Name: **Ore Drift** (VERIFY: search Google Play for an existing app with the same or a confusingly close name)
- Category: Game, Casual (or Simulation)
- Free, no in-app purchases, no ads

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
- Works fully offline. No account, no sign-in, no network needed.
- Optional reminders when your supply drop is ready or your hold is full. They are off until you turn them on.
- No ads. No purchases. No data collected.
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
Based on the code as it stands: no analytics, no ads, no account, no network calls. The save file stays on the device.
- Does your app collect or share any of the required user data types? **No**
- Is all of the user data collected by your app encrypted in transit? Not applicable (nothing is sent)
- Do you provide a way for users to request that their data be deleted? Not applicable. Players can wipe the save in Settings > Wipe save, or uninstall the app.
- Privacy policy URL: required even if you collect nothing. Host `docs/index.html` (GitHub Pages serves it from the `/docs` folder) and paste its address.
- VERIFY: the app declares the `INTERNET` permission because the Capacitor template includes it, but the game does not use it. Play's form asks about data collected, not permissions, so "no data collected" is still accurate. If you want, remove the permission and test that the app still runs.
- VERIFY: the manifest has `allowBackup="true"`, so Android Auto Backup may copy the save to the player's Google account. The privacy policy says so. Check Google's current Data safety guidance on whether OS-level backup counts as "collected". If you would rather avoid the question, set `android:allowBackup="false"` in `AndroidManifest.xml` (players then lose progress when changing phones).
- VERIFY: if you later add ads or analytics, update this form and the policy before releasing.

## Content rating questionnaire (draft answers)
Category: Game. Expect a low rating (everyone). Answer honestly in the questionnaire. My reading of the game:
- Violence: no
- Blood or gore: no
- Sexual content or nudity: no
- Profanity or crude humour: no
- Controlled substances (drugs, alcohol, tobacco): no
- Gambling or simulated gambling: no. Comets give random rewards, but nothing is paid for and no real or virtual currency is spent on chance.
- User-generated content or user-to-user communication: no
- Shares the user's location or personal information: no
- Digital purchases: no
- VERIFY: the exact question wording and categories change. Answer from the game's real behaviour, not from this list.

## Target audience and content
- Suggested target age: **13 and older** (or "18 and older"). This avoids the extra Families policy rules that apply when children are a target audience. VERIFY the current Families policy before choosing a younger group.
- Is the app appealing to children? An idle clicker with cartoon-free space art is not aimed at children, but answer for yourself.

## Ads declaration
- Contains ads: **No**

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
- `INTERNET`: from the Capacitor template; the game makes no network requests
- `SCHEDULE_EXACT_ALARM` is removed in the manifest because reminders do not need it

## Testing track reminder
For a new personal account (created after 13 Nov 2023): closed test with at least 12 testers opted in for 14 days in a row before you can apply for production. VERIFY the current rule in Play Console Help.
