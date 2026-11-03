// Restock service worker (ADR 0016). Plain JavaScript with no build step.
// It caches only the offline page and the icons. Next.js pages, RSC payloads and API calls always
// go to the network, so an old cached app can never be served after a deploy.

const CACHE_PREFIX = "restock-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];
const FALLBACK_URL = "/r";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, ...STATIC_ASSETS])));
  // No skipWaiting here: a new version waits until the page asks for it, so the "New version ready"
  // banner decides when the switch happens.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "SKIP_WAITING" || (data && data.type === "SKIP_WAITING")) self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page loads go to the network. Only when the network fails is the cached offline page shown.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL).then((cached) => cached || Response.error())));
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((cached) => cached || fetch(request)));
  }
});

/** A same-origin path to open, or the fallback. Rejects absolute and protocol-relative URLs. */
function safePath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return FALLBACK_URL;
  }
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : FALLBACK_URL;
  } catch {
    return FALLBACK_URL;
  }
}

function readPayload(data) {
  let raw = {};
  try {
    raw = data ? data.json() : {};
  } catch {
    raw = { body: data ? data.text() : "" };
  }
  return {
    title: typeof raw.title === "string" && raw.title ? raw.title : "Restock",
    body: typeof raw.body === "string" ? raw.body : "",
    url: safePath(raw.url),
    notificationId: typeof raw.notificationId === "string" ? raw.notificationId : null,
    tag: typeof raw.tag === "string" && raw.tag ? raw.tag : undefined,
  };
}

async function windowClients() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true });
}

async function handlePush(payload) {
  const windows = await windowClients();
  const active = windows.filter((client) => client.visibilityState === "visible" && client.focused);
  if (active.length > 0) {
    // The app is open and in front: it shows the card in place, so no system notification.
    for (const client of active) client.postMessage({ type: "PUSH", payload });
    return;
  }
  await self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/maskable-192.png",
    data: { url: payload.url, notificationId: payload.notificationId },
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(readPayload(event.data)));
});

async function reportOpened(notificationId) {
  if (!notificationId) return;
  try {
    await fetch("/api/push/opened", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ notificationId }),
    });
  } catch {
    // Opening the app matters more than the receipt; the server treats a missing receipt as unopened.
  }
}

async function openTarget(path) {
  const target = new URL(path, self.location.origin).href;
  const windows = await windowClients();
  const exact = windows.find((client) => client.url === target);
  if (exact) return exact.focus();
  const existing = windows[0];
  if (existing) {
    const focused = await existing.focus();
    // navigate() only works on a window this worker controls; otherwise the focused window is enough.
    return "navigate" in focused ? focused.navigate(target).catch(() => focused) : focused;
  }
  return self.clients.openWindow(target);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(Promise.all([openTarget(safePath(data.url)), reportOpened(data.notificationId)]));
});
