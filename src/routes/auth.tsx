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

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const next: typeof errors = {};
        const em = emailSchema.safeParse(email);
        if (!em.success) next.email = em.error.issues[0].message;
        if (!password) next.password = "Enter your password";
        setErrors(next);
        if (Object.keys(next).length) return;
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email: em.data!, password });
        setBusy(false);
        if (error) {
          const message = authErrorMessage(error);
          setErrors({ form: message });
          return toast.error(message);
        }
        navigate({ to: "/dashboard" });
      }}
    >
      {errors.form && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{errors.form}</div>
      )}
      <div>
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
        <FieldError msg={errors.email} />
      </div>
      <div>
        <Label htmlFor="si-pw">Password</Label>
        <Input id="si-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
        <FieldError msg={errors.password} />
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
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; ngoName?: string; form?: string }>({});
  const [checkEmail, setCheckEmail] = useState(false);

  if (checkEmail) {
    return (
      <div className="mt-6 rounded-md border p-4 text-sm">
        <p className="font-medium">Confirm your email to finish</p>
        <p className="mt-1 text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{email}</span>. Open it to activate your
          account{role === "ngo" ? ", then complete your NGO profile so an admin can verify you." : "."}
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-4 space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const next: typeof errors = {};
        const em = emailSchema.safeParse(email);
        if (!em.success) next.email = em.error.issues[0].message;
        const pw = passwordSchema.safeParse(password);
        if (!pw.success) next.password = pw.error.issues[0].message;
        if (fullName.trim().length < 2) next.fullName = "Enter your full name";
        if (role === "ngo" && ngoName.trim().length < 2) next.ngoName = "Enter your organisation name";
        setErrors(next);
        if (Object.keys(next).length) {
          toast.error("Please fix the highlighted fields");
          return;
        }
        setBusy(true);
        const { data, error } = await supabase.auth.signUp({
          email: em.data!,
          password: pw.data!,
          options: {
            emailRedirectTo: window.location.origin + "/onboarding",
            data: { full_name: fullName.trim(), role, ngo_name: role === "ngo" ? ngoName.trim() : null },
          },
        });
        setBusy(false);
        if (error) {
          const message = authErrorMessage(error);
          setErrors({ form: message });
          return toast.error(message);
        }
        // No session means email confirmation is required.
        if (!data.session) {
          setCheckEmail(true);
          toast.success("Account created — check your email to confirm.");
          return;
        }
        toast.success(role === "ngo" ? "Account created. Complete your profile so an admin can verify your NGO." : "Account created!");
        navigate({ to: "/onboarding" });
      }}
    >
      {errors.form && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{errors.form}</div>
      )}
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
        {role === "ngo" && (
          <p className="mt-2 text-xs text-muted-foreground">
            NGO accounts are reviewed by an admin before they can accept donations.
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="su-name">{role === "ngo" ? "Your name" : "Full name"}</Label>
        <Input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} aria-invalid={!!errors.fullName} />
        <FieldError msg={errors.fullName} />
      </div>
      {role === "ngo" && (
        <div>
          <Label htmlFor="su-ngo">NGO name</Label>
          <Input id="su-ngo" value={ngoName} onChange={(e) => setNgoName(e.target.value)} maxLength={150} aria-invalid={!!errors.ngoName} />
          <FieldError msg={errors.ngoName} />
        </div>
      )}
      <div>
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
        <FieldError msg={errors.email} />
      </div>
      <div>
        <Label htmlFor="su-pw">Password</Label>
        <Input id="su-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
        <FieldError msg={errors.password} />
        <p className="mt-1 text-xs text-muted-foreground">At least 8 characters, with a letter and a number. Avoid common passwords.</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
      <div className="relative my-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div></div>
      <GoogleButton />
    </form>
  );
}

