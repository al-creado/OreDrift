# Ore Drift

A space-mining idle clicker for Android. Tap an asteroid, hire auto-miners, install upgrades, catch comets, finish missions, and relocate to richer belts for permanent bonuses.

It is a Vite and vanilla JavaScript game wrapped for Android with Capacitor. It plays offline with no account and no analytics. It is free with ads: a banner at the bottom plus optional rewarded ads (Google AdMob). A Shop for optional purchases through Google Play is built but switched off for now (see [Ads and shop](#ads-and-shop)).

- Privacy policy: [docs/index.html](docs/index.html) is published through GitHub Pages (the link Play Console needs) and is also built into the app (Settings > Privacy policy), which reads the same file, so the two always match
- Game rules, design and publishing steps: [docs/BUILD-GUIDE.md](docs/BUILD-GUIDE.md) (written earlier in the project, so it does not describe every recent feature)

## What is in the game

- **Mining:** tap the asteroid, hire 7 kinds of vessels (they mine while you are away, up to 8 hours at half rate), install 15 upgrades.
- **Flyers:** comets give a pile of ore, supply ships give a temporary x7 output boost.
- **Goals tab:** a 7-day supply streak, daily and weekly missions (a mission you do not like can be swapped), the daily cache, and 72 commendations in tiered chains, nine of them secret. Secret ones are not shown at all until they are earned, and the total count stays hidden until every secret one is found. Each commendation gives a permanent bonus at once, and a one-time ore gift that the player claims.
- **Belt tab:** Relocate resets the run and gives exactly **1 survey point** (the currency for skins) plus a permanent **survey bonus** that grows with how much you mined in the run (`floor(sqrt(ore / cost))` steps of +10% output and taps, kept forever). The cost of a step grows with the steps already held: `1,000,000 * (1 + steps / 10) ^ 3` ore in a run, so relocating cannot be spammed. Cosmetics: skins for the asteroid, the fleet and the sky, bought with survey points (spending them never lowers the bonus). Settings: sound, music, vibration, reminders, how to play, and the privacy policy (shown inside the app).
- **Captain's log tab:** the Captain's journal (10 chapters that open in order as you play) and the logbook of stats.
- **Extras:** weekly events, a welcome-back summary, a four-card tutorial for new players, local reminders, synthesized music and sound effects.
- **Bottom nav:** Fleet, Upgrades, Goals, Belt, Captain's log, and Shop (hidden until it is switched on). It uses icons only (`src/icons.js`).

## Easter eggs (spoilers)

- **Rubber duck:** a rare flyer (about 1 in 33). It pays 30 to 60 minutes of output plus a 20 second x7 boost, quacks, and counts as a flyer caught. A "Rubber ducks" line appears in the logbook after the first one. Rules are in `logic.js` (`DUCK_*`, `catchDuck`), the drawing in `scene.js`, the quack in `audio.js`.
- **8-bit mode:** on the asteroid, swipe up, up, down, down, left, right, left, right, then tap twice (on a keyboard: the arrow keys, then B and A). The game turns into pixels for 60 seconds: the canvas is drawn at low resolution, the UI gets a pixel font, hard edges and scanlines, and sounds become square waves. Matching is in `logic.js` (`feedSecretCode`); the mode is wired in `main.js` and styled under `html.retro` in `style.css`. Nothing in it is saved, but switching it on earns the secret **Old School** commendation, and chapter 9 of the Captain's journal holds a cryptic clue to the code (data.js, `JOURNAL`).

## Run it in a browser

Needs Node.js 24 or newer.

```bash
npm install
npm run dev        # http://localhost:5173/
npm test           # Vitest: game rules, save validation, pacing simulation
npm run build      # production build into dist/
```

## Run it on Android

Needs Android Studio with an Android SDK platform (API 36) and its bundled JDK 21 selected as the Gradle JDK.

```bash
npm run sync       # build the web app and copy it into the Android project
npx cap open android
```

Press Run in Android Studio with a phone (USB debugging on) or an emulator. After you pull new code, run `npm run sync` again before building.

Built APKs are named `ore-drift.apk` (see `android/app/build.gradle`). The debug one is in `android/app/build/outputs/apk/debug/`.

### Versions

The version appears in two places, and they should match:

- `android/app/build.gradle`: `versionName` and `versionCode`. Raise `versionCode` for every upload to Play (it can never repeat).
- `package.json`: `version`, which is the number shown in Settings inside the game.

### Release build

1. Create an upload key once (and back it up; Play expects the same key for every upload). From `android/`:
   `keytool -genkey -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in your values. These files are git-ignored. Never commit them. Keep them on every computer you build from.
3. `npm run sync`, then `cd android && ./gradlew bundleRelease`.
4. The bundle is `android/app/build/outputs/bundle/release/app-release.aab`. Upload it to Play Console.

Application ID: `com.al.oredrift` (cannot change after publishing).

## Project layout

```
src/
  data.js       vessels, upgrades, commendations, skins, products, constants
  logic.js      pure game rules (no DOM); state and time are passed in
  storage.js    save validation, Capacitor Preferences with localStorage fallback
  native.js     Capacitor wrappers: lifecycle, back button, haptics, status bar, reminders
  ads.js        AdMob: bottom banner, rewarded ads, consent
  store.js      Google Play Billing: shop purchases and restore
  ui.js         DOM building and updating, tabs, tutorial, toasts
  icons.js      line icons for the bottom nav and the tutorial
  scene.js      canvas: asteroid, ships, comet, particles, sky
  belts.js      the look of each belt (colours, shape, ring) and which ships orbit it
  ships.js      the silhouette of each vessel type
  audio.js      synthesized sound effects (shared Web Audio context)
  music.js      slow space-ambient background music, synthesized
  main.js       boot, game loop, wiring, the in-app splash
  splash-logo.webp  artwork for the in-app splash
tests/          Vitest suites (game rules, saves, the privacy page) and the pacing simulator
reference/      the original web prototype the game was ported from
store/          Play Store listing text, icon, feature graphic, product icons, screenshots
assets/         source art for the app icon and splash screen
docs/           privacy policy page and the build guide
android/        Capacitor Android project
```

## Ads and shop

- `src/ads.js`: AdMob banner, rewarded ads, consent. It uses the **live** ad units (`ADS_TESTING = false`). The AdMob app ID is separate, in `android/app/src/main/res/values/strings.xml`. Do not tap your own live ads: set `ADS_TESTING = true` for test builds, or register your phone as a test device in AdMob.
- `src/store.js`: Google Play Billing through `@capgo/native-purchases`. Products are listed in `src/data.js` (`PRODUCTS`) and must exist and be active in Play Console with the same IDs. See `store/listing.md` for the table, prices and test steps.
- **The Shop is switched off.** `SHOP_ENABLED` in `src/main.js` is `false`, which hides the Shop tab and turns Billing off. Set it to `true` once the app can sell for real (production access granted and the six products active).
- On the dev server you can try both on a desktop with `?mockads&mockstore`, e.g. `http://localhost:5173/?mockads&mockstore`. These flags are removed from production builds.

## Splash screen and icons

- Source art is in `assets/` (`icon-*.png`, `splash.png`). Regenerate the Android images with `npx capacitor-assets generate --android --assetPath assets`, then `npm run sync`.
- Older phones show the native splash picture. Android 12 and newer show a plain navy launch screen (an empty icon, set in `android/app/src/main/res/values/styles.xml`), and the in-app splash in `index.html` / `src/main.js` fades out when the game is ready.
- The notification icon is `android/app/src/main/res/drawable/ic_stat_ore.xml`.

## Store listing

`store/` holds what Play Console needs: `listing.md` (descriptions, data safety and declaration drafts, product table), `icon-512.png`, `feature-graphic-1024x500.png`, `product-icons/` (one icon per in-app product) and `screenshots/` (see its README). Retake the screenshots when the look of the game changes.

## Before publishing

- Raise `versionCode`, and keep `versionName` and `package.json` in step.
- Check that `ADS_TESTING` is `false` and the AdMob IDs are yours. Turn `SHOP_ENABLED` on only when the products are active.
- `PRIVACY_URL` in `src/main.js` points at the hosted policy; keep `docs/index.html` in sync with what the app does.
- Update the Play Console declarations (data safety, ads, in-app purchases) to match.
- Go through the checklist in section 10 of the [build guide](docs/BUILD-GUIDE.md) on a real phone.
