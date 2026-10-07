import { isKioskBusy } from './kioskBusy';

// The kiosk phone keeps one SPA page open for days and never navigates, so
// a new deploy never reaches it (the service worker only swaps files on a
// reload). That left the doorbell running a weeks-old bundle - e.g. the
// one whose 24h uploads were rejected all day. Poll index.html and, when
// the bundle name changed, reload at a quiet moment.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function currentBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  const m = el?.src.match(/index-[A-Za-z0-9_-]+\.js/);
  return m ? m[0] : null;
}

async function latestBundle(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const m = (await res.text()).match(/index-[A-Za-z0-9_-]+\.js/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

async function reloadFresh() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs || []).map((r) => r.update().catch(() => {})));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // best effort - a plain reload still picks up the new index.html
  }
  window.location.reload();
}

export function startAutoUpdate() {
  const running = currentBundle();
  if (!running) return; // dev server - nothing to compare

  setInterval(async () => {
    const latest = await latestBundle();
    if (!latest || latest === running) return;
    // Never yank the page in the middle of a call, live view or a
    // conversation; the standby screen ('/') is the safe moment.
    if (isKioskBusy() || window.location.pathname !== '/') return;
    await reloadFresh();
  }, CHECK_INTERVAL_MS);
}
