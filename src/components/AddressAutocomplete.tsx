import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";
import { Input } from "@/components/ui/input";

type PickedPlace = { address: string; lat: number; lng: number };

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: PickedPlace) => void;
  placeholder?: string;
  id?: string;
}

// Uses Places API (New) AutocompleteSuggestion for a lightweight combobox.
export function AddressAutocomplete({ value, onChange, onPick, placeholder, id }: Props) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(async () => {
        const { AutocompleteSessionToken } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        sessionTokenRef.current = new AutocompleteSessionToken();
        setReady(true);
      })
      .catch((e) => console.warn("Google Maps failed to load", e));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    if (!ready || !v.trim() || v.length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const { AutocompleteSuggestion } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: v,
          sessionToken: sessionTokenRef.current!,
        });
        setSuggestions(suggestions.slice(0, 5));
        setOpen(true);
      } catch (e) {
        console.warn(e);
      }
    }, 250);
  }

  async function pick(s: google.maps.places.AutocompleteSuggestion) {
    if (!s.placePrediction) return;
    const place = s.placePrediction.toPlace();
    await place.fetchFields({ fields: ["formattedAddress", "location"] });
    const addr = place.formattedAddress ?? s.placePrediction.text.toString();
    const loc = place.location;
    if (loc) {
      onPick({ address: addr, lat: loc.lat(), lng: loc.lng() });
    } else {
      onChange(addr);
    }
    setOpen(false);
    setSuggestions([]);
    // Refresh session token after selection
    const { AutocompleteSessionToken } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
    sessionTokenRef.current = new AutocompleteSessionToken();
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        placeholder={placeholder ?? "Start typing an address…"}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((s, i) => {
            const text = s.placePrediction?.text.toString() ?? "";
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(s)}
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
