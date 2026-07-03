// Loader for the Google Maps JS API using the Lovable-managed browser key.
// Async loading with a global callback per the connector docs.

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let loadPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    __initGoogleMaps?: () => void;
    google: typeof google;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Google Maps browser key missing"));

  loadPromise = new Promise((resolve, reject) => {
    window.__initGoogleMaps = () => resolve(window.google);
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      libraries: "places,marker",
      callback: "__initGoogleMaps",
      v: "weekly",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loadPromise;
}
