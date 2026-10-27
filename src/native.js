/* Native behaviour behind Capacitor. Every call is a harmless no-op in a plain browser. */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } };
const quiet = (p) => { try { return Promise.resolve(p).catch(() => {}); } catch (e) { return Promise.resolve(); } };

export function impact(heavy) {
  if (!isNative()) { try { navigator.vibrate && navigator.vibrate(heavy ? 20 : 5); } catch (e) { /* ignore */ } return; }
  quiet(Haptics.impact({ style: heavy ? ImpactStyle.Medium : ImpactStyle.Light }));
}

export async function setupChrome() {
  if (!isNative()) return;
  await quiet(StatusBar.setStyle({ style: Style.Dark }));
  await quiet(StatusBar.setBackgroundColor({ color: '#0b1020' }));
  await quiet(StatusBar.setOverlaysWebView({ overlay: false }));
  await quiet(SplashScreen.hide());
}

/**
 * Pause/resume for both web (visibility) and native (appStateChange).
 * onHide runs when the game should stop and save; onShow when it should catch up.
 */
export function watchLifecycle(onHide, onShow) {
  let hidden = false;
  const hide = () => { if (!hidden) { hidden = true; onHide(); } };
  const show = () => { if (hidden) { hidden = false; onShow(); } };
  if (isNative()) {
    App.addListener('appStateChange', ({ isActive }) => (isActive ? show() : hide()));
  } else {
    document.addEventListener('visibilitychange', () => (document.hidden ? hide() : show()));
    addEventListener('pagehide', hide);
  }
}

/** From a non-Fleet tab go to Fleet; on Fleet exit the app. */
export function watchBackButton(getTab, goFleet) {
  if (!isNative()) return;
  App.addListener('backButton', () => {
    if (getTab() !== 'fleet') goFleet();
    else App.exitApp();
  });
}

/* ---------- optional reminders ---------- */
const ID_SUPPLY = 1, ID_CAP = 2;

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
  ? quiet(LocalNotifications.cancel({ notifications: [{ id: ID_SUPPLY }, { id: ID_CAP }] }))
  : Promise.resolve());

/**
 * Schedules (replacing earlier ones) a supply-drop reminder for 10:00 on the next local day
 * and a "hold is full" note when offline earnings reach the 8 h cap. `hasFleet` skips the second if nothing mines.
 */
export async function scheduleReminders(now, hasFleet) {
  if (!isNative()) return;
  await cancelReminders();
  const t = new Date(now);
  const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 10, 0, 0);
  const list = [{ id: ID_SUPPLY, title: 'Ore Drift', body: 'Your daily supply drop is ready.', schedule: { at: tomorrow, allowWhileIdle: true } }];
  if (hasFleet) {
    list.push({ id: ID_CAP, title: 'Ore Drift', body: 'Your hold is full. Offline mining has reached its 8 hour limit.', schedule: { at: new Date(now + 8 * 3600 * 1000), allowWhileIdle: true } });
  }
  await quiet(LocalNotifications.schedule({ notifications: list }));
}
