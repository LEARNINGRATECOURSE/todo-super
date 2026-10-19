const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;

/** Local notifications for the web: shown via the service worker when permitted. */
export const notificationsSupported = () => typeof Notification !== 'undefined';
export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported';

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported' as const;
  return Notification.requestPermission();
}

export async function notify(title: string, body: string, tag?: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: ICON, badge: ICON, data: { url: import.meta.env.BASE_URL } });
    } else {
      new Notification(title, { body, tag, icon: ICON });
    }
    return true;
  } catch {
    return false;
  }
}

/** Schedules an in-page timer; fires a notification only when the page is hidden (the sound/UI covers the visible case). */
export function scheduleLocal(ms: number, fn: () => void) {
  const t = window.setTimeout(fn, ms);
  return () => clearTimeout(t);
}
