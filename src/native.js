/* Native behaviour behind Capacitor. Every call is a harmless no-op in a plain browser. */
import { Capacitor, SystemBars } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } };
const quiet = (p) => { try { return Promise.resolve(p).catch(() => {}); } catch (e) { return Promise.resolve(); } };

let hapticsOn = true;
export function setHapticsEnabled(on) { hapticsOn = !!on; }

export function impact(heavy) {
  if (!hapticsOn) return;
  if (!isNative()) { try { navigator.vibrate && navigator.vibrate(heavy ? 20 : 5); } catch (e) { /* ignore */ } return; }
  quiet(Haptics.impact({ style: heavy ? ImpactStyle.Medium : ImpactStyle.Light }));
}

/** Fullscreen: hide the status and navigation bars (MainActivity does the same natively). */
export function hideBars() {
  if (!isNative()) return Promise.resolve();
  return quiet(SystemBars.hide());
}

export async function setupChrome() {
  if (!isNative()) return;
  await hideBars();
  // The game is fullscreen: MainActivity hides the system bars, so no status bar styling is needed here.
  await quiet(StatusBar.setStyle({ style: Style.Dark }));
  await quiet(SplashScreen.hide());
}

/**
 * Pause/resume for both web (visibility) and native (appStateChange).
 * onHide runs when the game should stop and save; onShow when it should catch up.
 */
export function watchLifecycle(onHide, onShow) {
  let hidden = false;
  const hide = () => { if (!hidden) { hidden = true; onHide(); } };
  const show = () => { if (hidden) { hidden = false; hideBars(); onShow(); } };
  if (isNative()) {
    App.addListener('appStateChange', ({ isActive }) => (isActive ? show() : hide()));
  } else {
    document.addEventListener('visibilitychange', () => (document.hidden ? hide() : show()));
    addEventListener('pagehide', hide);
  }
}

/** From a non-Fleet tab go to Fleet; on Fleet exit the app. */
export function watchBackButton(getTab, goFleet, closeOverlay) {
  if (!isNative()) return;
  App.addListener('backButton', () => {
    if (closeOverlay && closeOverlay()) return; // an open page (like the journal) closes first
    if (getTab() !== 'fleet') goFleet();
    else App.exitApp();
  });
}

/* ---------- optional reminders ---------- */
const ID_SUPPLY = 1, ID_CAP = 2, ID_POD = 3;

/** Asks for permission. Call only after the player turns reminders on. Resolves to true when granted. */
export async function requestNotifyPermission() {
  if (!isNative()) return false;
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch (e) { return false; }
}

export const cancelReminders = () => (isNative()
  ? quiet(LocalNotifications.cancel({ notifications: [{ id: ID_SUPPLY }, { id: ID_CAP }, { id: ID_POD }] }))
  : Promise.resolve());

/**
 * Schedules (replacing earlier ones) a supply-drop reminder for 10:00 on the next local day
 * and a "hold is full" note when offline earnings reach the 8 h cap. `hasFleet` skips the second if nothing mines.
 * `podAt` (ms, or 0) schedules "your cargo pod is ready" for when its cooldown ends; pass 0 when it is already ready.
 */
export async function scheduleReminders(now, hasFleet, podAt = 0) {
  if (!isNative()) return;
  await cancelReminders();
  const t = new Date(now);
  const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 10, 0, 0);
  // isExactNotification:false keeps these as normal inexact alarms. The default (exact) would send the player to
  // Android's "Alarms and reminders" settings screen every time the app goes to the background.
  const list = [{ id: ID_SUPPLY, title: 'Ore Drift', body: 'Your daily supply drop is ready.', isExactNotification: false, schedule: { at: tomorrow, allowWhileIdle: true } }];
  if (hasFleet) {
    list.push({ id: ID_CAP, title: 'Ore Drift', body: 'Your hold is full. Offline mining has reached its 8 hour limit.', isExactNotification: false, schedule: { at: new Date(now + 8 * 3600 * 1000), allowWhileIdle: true } });
  }
  if (podAt > now + 60 * 1000) {
    list.push({ id: ID_POD, title: 'Ore Drift', body: 'Your cargo pod is ready.', isExactNotification: false, schedule: { at: new Date(podAt), allowWhileIdle: true } });
  }
  await quiet(LocalNotifications.schedule({ notifications: list }));
}
