import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — FoodShare" },
      { name: "description", content: "Update your FoodShare name, contact details, and pickup address." },
      { property: "og:title", content: "Your FoodShare profile" },
      { property: "og:description", content: "Update your FoodShare name, contact details, and pickup address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles } = useAuth();
  const isNgo = roles.includes("ngo");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", address: "", ngo_name: "", lat: "", lng: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          ngo_name: data.ngo_name ?? "",
          lat: data.lat?.toString() ?? "",
          lng: data.lng?.toString() ?? "",
        });
      }
      setLoading(false);
    });
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const payload = {
      full_name: form.full_name.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      ngo_name: isNgo ? (form.ngo_name.trim() || null) : null,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Keep your details up to date so pickups go smoothly.</p>
      <form onSubmit={save} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="fn">Full name</Label>
          <Input id="fn" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} />
        </div>
        {isNgo && (
          <div>
            <Label htmlFor="ngo">NGO name</Label>
            <Input id="ngo" value={form.ngo_name} onChange={(e) => setForm({ ...form, ngo_name: e.target.value })} maxLength={150} />
          </div>
        )}
        <div>
          <Label htmlFor="ph">Phone</Label>
          <Input id="ph" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} />
        </div>
        <div>
          <Label htmlFor="ad">Address</Label>
          <AddressAutocomplete
            id="ad"
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v })}
            onPick={(p) => setForm({ ...form, address: p.address, lat: String(p.lat), lng: String(p.lng) })}
            placeholder="Search your pickup address…"
          />
          {form.lat && form.lng && (
            <p className="mt-1 text-xs text-muted-foreground">Location set · {Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}</p>
          )}
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      </form>
    </div>
  );
}
