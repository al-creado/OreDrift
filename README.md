# Ore Drift

A space-mining idle clicker for Android. Tap an asteroid, hire auto-miners, install upgrades, catch comets, finish daily missions, and relocate to richer belts for permanent bonuses.

It is a Vite and vanilla JavaScript game wrapped for Android with Capacitor. It plays offline with no account and no analytics. It is free with ads: a banner at the bottom plus optional rewarded ads (Google AdMob). A Shop sells optional items through Google Play (remove ads, ore packs, a starter bundle, a permanent boost).

- Privacy policy: see [docs/index.html](docs/index.html) (published through GitHub Pages)
- Full game rules, design and publishing steps: [docs/BUILD-GUIDE.md](docs/BUILD-GUIDE.md)

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

Press Run in Android Studio with a phone (USB debugging on) or an emulator.

### Release build

1. Create an upload key once (and back it up). From `android/`:
   `keytool -genkey -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in your values. These files are git-ignored. Never commit them.
3. `npm run sync`, then `cd android && ./gradlew bundleRelease`.
4. The bundle is `android/app/build/outputs/bundle/release/app-release.aab`. Raise `versionCode` in `android/app/build.gradle` for every upload.

Application ID: `com.al.oredrift` (cannot change after publishing).

## Project layout

```
src/
  data.js       vessels, upgrades, commendations, constants
  logic.js      pure game rules (no DOM); state and time are passed in
  storage.js    save validation, Capacitor Preferences with localStorage fallback
  native.js     Capacitor wrappers: lifecycle, back button, haptics, status bar, reminders
  ads.js        AdMob: bottom banner, rewarded ads, consent
  store.js      Google Play Billing: shop purchases and restore
  ui.js         DOM building and updating, tabs, toasts
  scene.js      canvas: asteroid, ships, comet, particles
  audio.js      synthesized sounds
  main.js       boot, game loop, wiring
tests/          Vitest suites and the pacing simulator
reference/      the original web prototype the game was ported from
store/          Play Store listing drafts and graphics
docs/           privacy policy page and the build guide
android/        Capacitor Android project
```

## Ads and shop

- `src/ads.js`: AdMob banner, rewarded ads, consent. Runs with Google's **test ads** until you set `ADS_TESTING = false` and fill in your real ad unit IDs. The AdMob app ID is separate, in `android/app/src/main/res/values/strings.xml`.
- `src/store.js`: Google Play Billing through `@capgo/native-purchases`. Products are listed in `src/data.js` (`PRODUCTS`) and must exist in Play Console with the same IDs. See `store/listing.md` for the table and test steps.
- On the dev server you can try both on a desktop with `?mockads&mockstore`, e.g. `http://localhost:5173/?mockads&mockstore`. These flags are removed from production builds.

## Before publishing

- Switch ads from test to live (see Ads and shop above) and create the six in-app products in Play Console.
- `PRIVACY_URL` in `src/main.js` already points at the hosted policy; keep `docs/index.html` in sync with what the app does.
- Replace the placeholder icons in `assets/` and the graphics in `store/` if you want your own art, then run `npx @capacitor/assets generate --android`.
- Go through the checklist in section 10 of the [build guide](docs/BUILD-GUIDE.md) on a real phone.
