import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { BadgeCheck, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Complete your profile — FoodShare" },
      { name: "description", content: "Add your contact details and pickup location so FoodShare can match you with nearby food donations." },
      { property: "og:title", content: "Complete your profile — FoodShare" },
      { property: "og:description", content: "Add contact details and location to start receiving nearby donation matches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

const nameSchema = z.string().trim().min(2, "Enter your full name").max(100);
const ngoNameSchema = z.string().trim().min(2, "Enter your organisation name").max(150);
const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a reachable phone number")
  .max(30)
  .regex(/^[+()\-\s\d]+$/, "Phone can only contain digits, spaces and + ( ) -");
const addressSchema = z.string().trim().min(5, "Enter your address").max(300);

type Errors = Partial<Record<"full_name" | "ngo_name" | "phone" | "address" | "coords", string>>;

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const isNgo = roles.includes("ngo");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [doc, setDoc] = useState<{ path: string | null; uploadedAt: string | null; note: string | null }>({
    path: null,
    uploadedAt: null,
    note: null,
  });
  const [form, setForm] = useState({ full_name: "", ngo_name: "", phone: "", address: "", lat: "", lng: "" });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load your profile. Please refresh.");
        if (data) {
          setForm({
            full_name: data.full_name ?? "",
            ngo_name: data.ngo_name ?? "",
            phone: data.phone ?? "",
            address: data.address ?? "",
            lat: data.lat?.toString() ?? "",
            lng: data.lng?.toString() ?? "",
          });
          setVerified(!!data.ngo_verified);
          setDoc({
            path: data.ngo_doc_path ?? null,
            uploadedAt: data.ngo_doc_uploaded_at ?? null,
            note: data.ngo_doc_note ?? null,
          });
        }
        setReady(true);
      });
  }, [user]);

  function validate(): Errors {
    const e: Errors = {};
    const n = nameSchema.safeParse(form.full_name);
    if (!n.success) e.full_name = n.error.issues[0].message;
    if (isNgo) {
      const g = ngoNameSchema.safeParse(form.ngo_name);
      if (!g.success) e.ngo_name = g.error.issues[0].message;
    }
    const p = phoneSchema.safeParse(form.phone);
    if (!p.success) e.phone = p.error.issues[0].message;
    const a = addressSchema.safeParse(form.address);
    if (!a.success) e.address = a.error.issues[0].message;
    if (!form.lat || !form.lng) e.coords = "Pick your address from the suggestions so we can match nearby donations.";
    return e;
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!user) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        ngo_name: isNgo ? form.ngo_name.trim() : null,
        phone: form.phone.trim(),
        address: form.address.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("row-level security")
          ? "You can only edit your own profile. Try signing out and back in."
          : error.message,
      );
      return;
    }
    toast.success("Profile complete");
    navigate({ to: "/dashboard" });
  }

  if (loading || !ready) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{isNgo ? "Complete your NGO profile" : "Complete your profile"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isNgo
          ? "We use your organisation details and location to match you with the closest donations."
          : "Your contact details help NGOs coordinate pickups with you."}
      </p>

      {isNgo && (
        <Card className={`mt-6 ${verified ? "border-primary/40 bg-primary/5" : "border-yellow-500/40 bg-yellow-500/5"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {verified ? <BadgeCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {verified ? "Verified NGO" : "Verification pending"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {verified
              ? "You can browse and accept donations right away."
              : "An admin reviews new organisations before they can accept donations. A complete profile speeds this up."}
          </CardContent>
        </Card>
      )}

      <form onSubmit={save} className="mt-6 space-y-4" noValidate>
        <Field id="ob-name" label={isNgo ? "Your name" : "Full name"} error={errors.full_name}>
          <Input
            id="ob-name"
            value={form.full_name}
            maxLength={100}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            aria-invalid={!!errors.full_name}
          />
        </Field>

        {isNgo && (
          <Field id="ob-ngo" label="Organisation name" error={errors.ngo_name}>
            <Input
              id="ob-ngo"
              value={form.ngo_name}
              maxLength={150}
              onChange={(e) => setForm({ ...form, ngo_name: e.target.value })}
              aria-invalid={!!errors.ngo_name}
            />
          </Field>
        )}

        <Field id="ob-phone" label="Contact phone" error={errors.phone}>
          <Input
            id="ob-phone"
            value={form.phone}
            maxLength={30}
            inputMode="tel"
            placeholder="+91 98765 43210"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            aria-invalid={!!errors.phone}
          />
        </Field>

        <Field id="ob-address" label={isNgo ? "Operating address" : "Address"} error={errors.address ?? errors.coords}>
          <AddressAutocomplete
            id="ob-address"
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v, lat: "", lng: "" })}
            onPick={(p) => setForm({ ...form, address: p.address, lat: String(p.lat), lng: String(p.lng) })}
            placeholder="Start typing your address…"
          />
          {form.lat && form.lng && (
            <p className="mt-1 text-xs text-muted-foreground">
              Location set · {Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}
            </p>
          )}
        </Field>

        {isNgo && user && (
          <NgoDocumentUpload
            userId={user.id}
            path={doc.path}
            uploadedAt={doc.uploadedAt}
            note={doc.note}
            onUploaded={(p) => setDoc({ path: p, uploadedAt: new Date().toISOString(), note: null })}
          />
        )}



        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>Skip for now</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
