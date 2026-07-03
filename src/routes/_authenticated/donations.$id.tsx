import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Check, Clock, MapPin, Package, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { donationStatusLabel } from "@/lib/distance";
import { PickupMap } from "@/components/PickupMap";

export const Route = createFileRoute("/_authenticated/donations/$id")({
  head: () => ({ meta: [{ title: "Donation — FoodShare" }] }),
  component: DonationDetail,
});

function DonationDetail() {
  const { id } = Route.useParams();
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const isNgo = roles.includes("ngo");
  const isAdmin = roles.includes("admin");

  const { data: donation, refetch } = useQuery({
    queryKey: ["donation", id],
    queryFn: async () => (await supabase.from("donations").select("*").eq("id", id).single()).data,
  });

  const { data: donorProfile } = useQuery({
    queryKey: ["profile", donation?.donor_id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", donation!.donor_id).single()).data,
    enabled: !!donation?.donor_id,
  });

  const { data: ngoProfile } = useQuery({
    queryKey: ["profile", donation?.accepted_by_ngo_id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", donation!.accepted_by_ngo_id!).single()).data,
    enabled: !!donation?.accepted_by_ngo_id,
  });

  const { data: imgUrl } = useQuery({
    queryKey: ["img", donation?.image_url],
    queryFn: async () => {
      if (!donation?.image_url) return null;
      const { data } = await supabase.storage.from("donation-images").createSignedUrl(donation.image_url, 3600);
      return data?.signedUrl ?? null;
    },
    enabled: !!donation?.image_url,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`donation-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "donations", filter: `id=eq.${id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refetch]);

  if (!donation) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  const isMyDonation = donation.donor_id === user?.id;
  const isAcceptedByMe = donation.accepted_by_ngo_id === user?.id;
  const canAccept = isNgo && donation.status === "pending";

  async function updateStatus(status: "accepted" | "picked_up" | "delivered" | "cancelled") {
    if (!user) return;
    const now = new Date().toISOString();
    const patch = {
      status,
      ...(status === "accepted" ? { accepted_by_ngo_id: user.id, accepted_at: now } : {}),
      ...(status === "picked_up" ? { picked_up_at: now } : {}),
      ...(status === "delivered" ? { delivered_at: now } : {}),
    };
    const { error } = await supabase.from("donations").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Marked as ${donationStatusLabel(status)}`);
  }

  const stages: { key: string; label: string; ts: string | null }[] = [
    { key: "pending", label: "Posted", ts: donation.created_at },
    { key: "accepted", label: "Accepted", ts: donation.accepted_at },
    { key: "picked_up", label: "Picked up", ts: donation.picked_up_at },
    { key: "delivered", label: "Delivered", ts: donation.delivered_at },
  ];
  const reachedIdx = stages.findIndex((s) => s.key === donation.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm"><Link to="/donations">← Back</Link></Button>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="h-40 w-full flex-shrink-0 overflow-hidden rounded-md bg-muted sm:w-40">
              {imgUrl ? (
                <img src={imgUrl} alt={donation.food_name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><Package className="h-10 w-10 text-muted-foreground" /></div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h1 className="text-2xl font-semibold">{donation.food_name}</h1>
                <Badge>{donationStatusLabel(donation.status)}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{donation.quantity}</p>
              {donation.description && <p className="mt-3 text-sm">{donation.description}</p>}
              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />{donation.pickup_address}</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Pickup by {new Date(donation.expiry_time).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {donation.lat != null && donation.lng != null && (
            <>
              <hr className="my-6" />
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pickup location</h2>
              <PickupMap lat={donation.lat} lng={donation.lng} label={donation.food_name} />
            </>
          )}

          <hr className="my-6" />
          <h2 className="text-sm font-medium text-muted-foreground">Progress</h2>
          <ol className="mt-3 space-y-3">
            {stages.map((s, i) => {
              const done = donation.status !== "cancelled" && i <= reachedIdx;
              return (
                <li key={s.key} className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : <span className="text-xs">{i + 1}</span>}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>{s.label}</div>
                    {s.ts && done && <div className="text-xs text-muted-foreground">{new Date(s.ts).toLocaleString()}</div>}
                  </div>
                </li>
              );
            })}
          </ol>

          {(isMyDonation || isAcceptedByMe || isAdmin) && (donorProfile || ngoProfile) && (
            <>
              <hr className="my-6" />
              <h2 className="text-sm font-medium text-muted-foreground">Contacts</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {donorProfile && (
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">Donor</div>
                    <div className="mt-1 flex items-center gap-2"><User className="h-3.5 w-3.5" />{donorProfile.full_name ?? "—"}</div>
                    {donorProfile.phone && <div className="mt-1 flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{donorProfile.phone}</div>}
                  </div>
                )}
                {ngoProfile && (
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">NGO</div>
                    <div className="mt-1 flex items-center gap-2"><User className="h-3.5 w-3.5" />{ngoProfile.ngo_name ?? ngoProfile.full_name ?? "—"}</div>
                    {ngoProfile.phone && <div className="mt-1 flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{ngoProfile.phone}</div>}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {canAccept && <Button onClick={() => updateStatus("accepted")}>Accept donation</Button>}
            {isAcceptedByMe && donation.status === "accepted" && <Button onClick={() => updateStatus("picked_up")}>Mark picked up</Button>}
            {isAcceptedByMe && donation.status === "picked_up" && <Button onClick={() => updateStatus("delivered")}>Mark delivered</Button>}
            {isMyDonation && donation.status === "pending" && (
              <Button variant="outline" onClick={async () => {
                if (!confirm("Cancel this donation?")) return;
                const { error } = await supabase.from("donations").delete().eq("id", id);
                if (error) toast.error(error.message);
                else { toast.success("Donation cancelled"); navigate({ to: "/donations" }); }
              }}>Cancel donation</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
