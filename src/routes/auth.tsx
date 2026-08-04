import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — FoodShare" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/\d/, "Password must include a number");

// Turns backend auth failures into something a person can act on.
function authErrorMessage(err: { message: string; code?: string; status?: number }) {
  const code = err.code ?? "";
  const msg = err.message ?? "";
  if (code === "weak_password" || /known to be weak/i.test(msg))
    return "That password appears in known data breaches. Please choose a stronger, unique one.";
  if (code === "user_already_exists" || /already registered/i.test(msg))
    return "An account with this email already exists. Try signing in instead.";
  if (code === "email_address_invalid" || /invalid.*email/i.test(msg)) return "That email address isn't valid.";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg))
    return "Email or password is incorrect.";
  if (code === "email_not_confirmed" || /not confirmed/i.test(msg))
    return "Please confirm your email first — check your inbox for the verification link.";
  if (code === "over_email_send_rate_limit" || err.status === 429)
    return "Too many attempts. Please wait a minute and try again.";
  if (code === "signup_disabled") return "New sign-ups are currently disabled.";
  if (/database error/i.test(msg))
    return "We couldn't finish creating your account (server error). Please try again in a moment.";
  if (/failed to fetch|network/i.test(msg)) return "Network problem — check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}


function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Welcome to FoodShare</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in or create an account to continue.</p>
      </div>
      <Tabs defaultValue="signin">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="signin"><SignInForm /></TabsContent>
        <TabsContent value="signup"><SignUpForm /></TabsContent>
      </Tabs>
    </div>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
        if (r.error) {
          toast.error("Google sign-in failed");
          setBusy(false);
        }
      }}
    >
      Continue with Google
    </Button>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const em = emailSchema.safeParse(email);
        if (!em.success) return toast.error("Enter a valid email");
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email: em.data, password });
        setBusy(false);
        if (error) return toast.error(error.message);
        navigate({ to: "/dashboard" });
      }}
    >
      <div>
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="si-pw">Password</Label>
        <Input id="si-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      <div className="relative my-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div></div>
      <GoogleButton />
    </form>
  );
}

function SignUpForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [ngoName, setNgoName] = useState("");
  const [role, setRole] = useState<"donor" | "ngo">("donor");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const em = emailSchema.safeParse(email);
        if (!em.success) return toast.error("Enter a valid email");
        const pw = passwordSchema.safeParse(password);
        if (!pw.success) return toast.error("Password must be at least 8 characters");
        if (role === "ngo" && !ngoName.trim()) return toast.error("NGO name is required");
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email: em.data,
          password: pw.data,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: fullName, role, ngo_name: role === "ngo" ? ngoName : null },
          },
        });
        setBusy(false);
        if (error) return toast.error(error.message);
        toast.success(role === "ngo" ? "Account created. An admin will verify your NGO before you can accept donations." : "Account created!");
        navigate({ to: "/dashboard" });
      }}
    >
      <div>
        <Label>I am a…</Label>
        <RadioGroup value={role} onValueChange={(v) => setRole(v as "donor" | "ngo")} className="mt-2 grid grid-cols-2 gap-2">
          <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${role === "donor" ? "border-primary bg-primary/5" : ""}`}>
            <RadioGroupItem value="donor" /> Donor
          </label>
          <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${role === "ngo" ? "border-primary bg-primary/5" : ""}`}>
            <RadioGroupItem value="ngo" /> NGO
          </label>
        </RadioGroup>
      </div>
      <div>
        <Label htmlFor="su-name">{role === "ngo" ? "Your name" : "Full name"}</Label>
        <Input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
      </div>
      {role === "ngo" && (
        <div>
          <Label htmlFor="su-ngo">NGO name</Label>
          <Input id="su-ngo" value={ngoName} onChange={(e) => setNgoName(e.target.value)} required maxLength={150} />
        </div>
      )}
      <div>
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="su-pw">Password</Label>
        <Input id="su-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
      <div className="relative my-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div></div>
      <GoogleButton />
    </form>
  );
}
