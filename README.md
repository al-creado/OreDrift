# Ore Drift

A space-mining idle clicker for Android. Tap an asteroid, hire auto-miners, install upgrades, catch comets, finish daily missions, and relocate to richer belts for permanent bonuses.

It is a Vite and vanilla JavaScript game wrapped for Android with Capacitor. It works fully offline: no account, no ads, no analytics, no network calls.

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

## Before publishing

- Set `PRIVACY_URL` in `src/main.js` to the hosted policy address.
- Replace the placeholder icons in `assets/` and the graphics in `store/` if you want your own art, then run `npx @capacitor/assets generate --android`.
- Go through the checklist in section 10 of the [build guide](docs/BUILD-GUIDE.md) on a real phone.
