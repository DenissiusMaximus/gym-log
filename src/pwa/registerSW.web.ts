import { persist } from '../data/useData';
import { useUi } from '../data/useUi';
import { logError } from '../dev/errorLog';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let registration: ServiceWorkerRegistration | null = null;

const isLocalhost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

/** A waiting worker next to an active controller means an update is ready to apply. */
function watch(reg: ServiceWorkerRegistration) {
  const ui = useUi.getState();
  const markWaiting = () => {
    if (navigator.serviceWorker.controller) {
      ui.setUpdateReady(true);
      ui.setSwStatus('waiting');
    }
  };
  if (reg.waiting) markWaiting();
  else if (reg.installing) ui.setSwStatus('installing');
  else if (reg.active) ui.setSwStatus('active');

  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    ui.setSwStatus('installing');
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') markWaiting();
      if (worker.state === 'activated' && !reg.waiting) ui.setSwStatus('active');
    });
  });
}

export function registerSW(): void {
  const ui = useUi.getState();
  if (!('serviceWorker' in navigator)) return ui.setSwStatus('unsupported');
  if (isLocalhost()) return ui.setSwStatus('localhost');

  let lastCheck = Date.now();
  // iOS resumes a PWA without navigation, so the browser never re-checks sw.js by itself.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !registration) return;
    if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastCheck = Date.now();
    registration.update().catch((error) => logError('sw-update', error));
  });

  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      registration = reg;
      watch(reg);
    })
    .catch((error) => {
      ui.setSwStatus('error');
      logError('sw-register', error);
    });
}

/**
 * Activates the waiting worker once pending writes are flushed, then reloads.
 * Waiting for the queue first guarantees the last edit is not lost to the reload.
 */
export async function applyUpdate(): Promise<void> {
  await persist.whenIdle();
  const waiting = registration?.waiting;
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/** Unregisters service workers and clears Cache Storage. IndexedDB data is not touched. */
export async function resetAppCache(): Promise<void> {
  const registrations = await navigator.serviceWorker?.getRegistrations?.();
  await Promise.all((registrations ?? []).map((r) => r.unregister()));
  if (typeof caches !== 'undefined') {
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  }
}
