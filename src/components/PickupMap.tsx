import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";

interface Props {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
}

export function PickupMap({ lat, lng, label, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !ref.current) return;
        const map = new google.maps.Map(ref.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        new google.maps.Marker({ map, position: { lat, lng }, title: label });
      })
      .catch((e) => console.warn(e));
    return () => {
      cancelled = true;
    };
  }, [lat, lng, label]);

  return <div ref={ref} className={className ?? "h-64 w-full overflow-hidden rounded-md border"} />;
}
