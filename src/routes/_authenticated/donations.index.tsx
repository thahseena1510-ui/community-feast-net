import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Clock, MapPin, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { donationStatusLabel, formatKm, haversineKm } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/donations/")({
  head: () => ({ meta: [{ title: "Donations — FoodShare" }] }),
  component: DonationsList,
});

function DonationsList() {
  const { user, roles } = useAuth();
  const isNgo = roles.includes("ngo");
  const isAdmin = roles.includes("admin");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("lat,lng,ngo_verified").eq("id", user!.id).single()).data,
    enabled: !!user,
  });

  const { data: donations, refetch } = useQuery({
    queryKey: ["donations-list", roles.join(","), user?.id],
    queryFn: async () => {
      const q = supabase.from("donations").select("*").order("created_at", { ascending: false }).limit(100);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("donations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  const showDistance = profile?.lat != null && profile?.lng != null;
  const items = (donations ?? []).map((d) => ({
    ...d,
    distance:
      showDistance && d.lat != null && d.lng != null
        ? haversineKm({ lat: profile!.lat!, lng: profile!.lng! }, { lat: d.lat, lng: d.lng })
        : null,
  })).sort((a, b) => {
    if (isNgo && !isAdmin && a.distance != null && b.distance != null) return a.distance - b.distance;
    return 0;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {isNgo ? "Available donations" : isAdmin ? "All donations" : "My donations"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNgo
              ? profile?.ngo_verified
                ? "Pending donations are visible here. Tap one to accept."
                : "Your NGO must be verified before you can accept donations."
              : isAdmin
              ? "Every donation across the platform."
              : "Donations you've posted."}
          </p>
        </div>
        {!isNgo && !isAdmin && (
          <Button asChild><Link to="/donations/new">Post donation</Link></Button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No donations yet.</CardContent></Card>
        )}
        {items.map((d) => (
          <Link key={d.id} to="/donations/$id" params={{ id: d.id }} className="block">
            <Card className="transition-colors hover:bg-accent/50">
              <CardContent className="flex items-start gap-4 p-4">
                {d.image_url ? (
                  <ImagePreview path={d.image_url} />
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-medium">{d.food_name}</h3>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d.quantity}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.pickup_address}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Expires {new Date(d.expiry_time).toLocaleString()}</span>
                    {d.distance != null && <span>· {formatKm(d.distance)} away</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    pending: "secondary",
    accepted: "default",
    picked_up: "default",
    delivered: "outline",
    cancelled: "destructive",
  };
  return <Badge variant={variant[status] ?? "secondary"}>{donationStatusLabel(status)}</Badge>;
}

function ImagePreview({ path }: { path: string }) {
  const { data } = useQuery({
    queryKey: ["donation-img", path],
    queryFn: async () => {
      const { data } = await supabase.storage.from("donation-images").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
    staleTime: 30 * 60 * 1000,
  });
  return (
    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
      {data && <img src={data} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}
