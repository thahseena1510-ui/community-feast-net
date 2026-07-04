import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/donations/new")({
  head: () => ({ meta: [{ title: "Post donation — FoodShare" }] }),
  component: NewDonation,
});

const schema = z.object({
  food_name: z.string().trim().min(2).max(100),
  quantity: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).optional(),
  pickup_address: z.string().trim().min(4).max(300),
  expiry_time: z.string().min(1),
});

function NewDonation() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [form, setForm] = useState({
    food_name: "",
    quantity: "",
    description: "",
    pickup_address: "",
    expiry_time: "",
    lat: "",
    lng: "",
  });

  if (!roles.includes("donor") && !roles.includes("admin")) {
    return <div className="p-8 text-sm text-muted-foreground">Only donors can post donations.</div>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (new Date(form.expiry_time).getTime() < Date.now() - 60_000) return toast.error("Pickup time must be in the future");
    setBusy(true);
    let image_url: string | null = null;
    if (image) {
      const path = `${user.id}/${Date.now()}-${image.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("donation-images").upload(path, image);
      if (upErr) { setBusy(false); return toast.error(upErr.message); }
      image_url = path;
    }
    const { data, error } = await supabase.from("donations").insert({
      donor_id: user.id,
      food_name: parsed.data.food_name,
      quantity: parsed.data.quantity,
      description: parsed.data.description || null,
      pickup_address: parsed.data.pickup_address,
      expiry_time: new Date(form.expiry_time).toISOString(),
      image_url,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Donation posted!");
    navigate({ to: "/donations/$id", params: { id: data.id } });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Post a donation</h1>
      <p className="mt-1 text-sm text-muted-foreground">NGOs nearby get notified instantly.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="fn">Food name *</Label>
          <Input id="fn" value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })} required maxLength={100} placeholder="e.g. Veg biryani" />
        </div>
        <div>
          <Label htmlFor="qty">Quantity *</Label>
          <Input id="qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required maxLength={60} placeholder="e.g. 20 meals / 5 kg" />
        </div>
        <div>
          <Label htmlFor="dsc">Description</Label>
          <Textarea id="dsc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={3} placeholder="Anything the NGO should know — packaging, dietary info, etc." />
        </div>
        <div>
          <Label htmlFor="img">Photo</Label>
          <Input id="img" type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <Label htmlFor="addr">Pickup address *</Label>
          <AddressAutocomplete
            id="addr"
            value={form.pickup_address}
            onChange={(v) => setForm({ ...form, pickup_address: v })}
            onPick={(p) => setForm({ ...form, pickup_address: p.address, lat: String(p.lat), lng: String(p.lng) })}
            placeholder="Start typing an address…"
          />
          {form.lat && form.lng && (
            <p className="mt-1 text-xs text-muted-foreground">Location set · {Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}</p>
          )}
        </div>
        <div>
          <Label>Pickup by *</Label>
          <PickupDateTime value={form.expiry_time} onChange={(v) => setForm({ ...form, expiry_time: v })} />
          <p className="mt-1 text-xs text-muted-foreground">Latest time an NGO can pick this up.</p>
        </div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Posting…" : "Post donation"}</Button>
      </form>
    </div>
  );
}
