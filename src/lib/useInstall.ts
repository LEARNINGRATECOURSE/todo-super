import { useEffect, useState } from 'react';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach((l) => l()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** PWA install state: `canInstall` when the browser has offered a native prompt. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((n) => n + 1); listeners.add(l); return () => void listeners.delete(l); }, []);
  return {
    canInstall: !!deferred,
    installed: isStandalone(),
    ios: isIOS(),
    install: async () => { if (!deferred) return; await deferred.prompt(); await deferred.userChoice; deferred = null; listeners.forEach((l) => l()); },
  };
}
