/*
 * Rewarded ads (Google AdMob). Every ad is opt-in: the player taps a button and chooses to watch.
 * Ads exist only in the Android app; in a browser everything here reports "unavailable".
 *
 * BEFORE RELEASE: set ADS_TESTING to false and fill in REWARDED_AD_UNIT_ID and BANNER_AD_UNIT_ID with your real AdMob ad unit IDs.
 * Also replace the test app ID in android/app/src/main/res/values/strings.xml (admob_app_id).
 */
import { AdMob, RewardAdPluginEvents, AdmobConsentStatus, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } from '@capacitor-community/admob';
import { isNative } from './native.js';

export const ADS_TESTING = false;
const TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917'; // Google's official test unit
const REWARDED_AD_UNIT_ID = 'ca-app-pub-7489584099500811/8223894273';

const TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741'; // Google's official adaptive banner test unit
const BANNER_AD_UNIT_ID = 'ca-app-pub-7489584099500811/7513659863';

const adId = ADS_TESTING ? TEST_REWARDED_AD_UNIT_ID : REWARDED_AD_UNIT_ID;
const bannerId = ADS_TESTING ? TEST_BANNER_AD_UNIT_ID : BANNER_AD_UNIT_ID;

// `?mockads` in the dev server fakes an ad so the UI can be tried in a desktop browser. Stripped from production builds.
const MOCK = import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('mockads');

const AD_TIMEOUT_MS = 3 * 60 * 1000;

let ready = false;
let privacyOptions = false;
let busy = false;

/** True once consent is settled and the SDK is initialized. */
export const adsAvailable = () => MOCK || (ready && !!adId);
/** True when the player must be able to reopen the ad consent choices (EEA/UK rule). */
export const needsPrivacyOptions = () => privacyOptions;

/** Asks for consent where the law requires it, then starts the SDK. Safe to call once at boot; never throws. */
export async function initAds() {
  if (MOCK) { ready = true; return; }
  if (!isNative() || !adId) return;
  try {
    let info = await AdMob.requestConsentInfo();
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      info = await AdMob.showConsentForm();
    }
    privacyOptions = info.privacyOptionsRequirementStatus === 'REQUIRED';
    if (!info.canRequestAds) return;
    await AdMob.initialize({ initializeForTesting: ADS_TESTING });
    ready = true;
  } catch (e) {
    ready = false;
  }
}

export async function openPrivacyOptions() {
  if (!isNative()) return;
  try { await AdMob.showPrivacyOptionsForm(); } catch (e) { /* ignore */ }
}

/**
 * Loads and shows one rewarded ad.
 * Resolves 'rewarded' when the player earned the reward, 'closed' when they left early,
 * or 'unavailable' when no ad could be loaded or shown.
 */
export async function showRewarded() {
  if (!adsAvailable() || busy) return 'unavailable';
  if (MOCK) return new Promise((r) => setTimeout(() => r('rewarded'), 800));
  busy = true;
  const handles = [];
  try {
    return await new Promise(async (resolve) => {
      let earned = false, done = false;
      // Safety net: if the SDK never reports the ad closing, give up so the lock below is released.
      const timer = setTimeout(() => finish(earned ? 'rewarded' : 'unavailable'), AD_TIMEOUT_MS);
      const finish = (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      };
      try {
        handles.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }));
        handles.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(earned ? 'rewarded' : 'closed')));
        handles.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish('unavailable')));
        await AdMob.prepareRewardVideoAd({ adId, isTesting: ADS_TESTING });
        // The native call resolves only when the reward is earned; closing early is reported by Dismissed.
        AdMob.showRewardVideoAd().then(() => { earned = true; }).catch(() => finish('unavailable'));
      } catch (e) {
        finish('unavailable');
      }
    });
  } finally {
    handles.forEach((h) => { try { h.remove(); } catch (e) { /* ignore */ } });
    busy = false;
  }
}

/* ---------- banner (always visible at the very bottom, until the player removes ads) ---------- */
let bannerOn = false;
let bannerListening = false;

/** The banner is a native overlay, so the page reserves its height: --banner-h on <html>. */
function setBannerHeight(px) {
  const root = document.documentElement;
  root.style.setProperty('--banner-h', Math.max(0, Math.round(px)) + 'px');
  root.classList.toggle('has-banner', px > 0);
}

export async function showBanner() {
  if (bannerOn) return;
  if (MOCK) {
    bannerOn = true;
    let el = document.getElementById('mockbanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mockbanner';
      el.textContent = 'Test banner ad';
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:50px;display:grid;place-items:center;background:#fff;color:#000;font:600 14px sans-serif;z-index:50';
      document.body.appendChild(el);
    }
    el.hidden = false;
    setBannerHeight(50);
    return;
  }
  if (!ready || !bannerId) return;
  try {
    if (!bannerListening) {
      bannerListening = true;
      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => setBannerHeight(info.height));
    }
    await AdMob.showBanner({ adId: bannerId, isTesting: ADS_TESTING, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin: 0 });
    bannerOn = true;
  } catch (e) {
    bannerOn = false;
    setBannerHeight(0);
  }
}

export async function hideBanner() {
  bannerOn = false;
  setBannerHeight(0);
  if (MOCK) { const el = document.getElementById('mockbanner'); if (el) el.hidden = true; return; }
  if (!isNative()) return;
  try { await AdMob.removeBanner(); } catch (e) { /* nothing to remove */ }
}
