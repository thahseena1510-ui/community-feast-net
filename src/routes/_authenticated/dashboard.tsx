import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FoodShare" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, roles } = useAuth();
  const isNgo = roles.includes("ngo");
  const isAdmin = roles.includes("admin");
  const isDonor = roles.includes("donor");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["dash-stats", user?.id, roles.join(",")],
    queryFn: async () => {
      if (isAdmin) {
        const [all, delivered, ngos] = await Promise.all([
          supabase.from("donations").select("*", { count: "exact", head: true }),
          supabase.from("donations").select("*", { count: "exact", head: true }).eq("status", "delivered"),
          supabase.from("profiles").select("*", { count: "exact", head: true }).not("ngo_name", "is", null),
        ]);
        return { total: all.count ?? 0, delivered: delivered.count ?? 0, ngos: ngos.count ?? 0 };
      }
      if (isNgo) {
        const [available, mine, delivered] = await Promise.all([
          supabase.from("donations").select("*", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("donations").select("*", { count: "exact", head: true }).eq("accepted_by_ngo_id", user!.id),
          supabase.from("donations").select("*", { count: "exact", head: true }).eq("accepted_by_ngo_id", user!.id).eq("status", "delivered"),
        ]);
        return { available: available.count ?? 0, mine: mine.count ?? 0, delivered: delivered.count ?? 0 };
      }
      const [posted, pending, delivered] = await Promise.all([
        supabase.from("donations").select("*", { count: "exact", head: true }).eq("donor_id", user!.id),
        supabase.from("donations").select("*", { count: "exact", head: true }).eq("donor_id", user!.id).eq("status", "pending"),
        supabase.from("donations").select("*", { count: "exact", head: true }).eq("donor_id", user!.id).eq("status", "delivered"),
      ]);
      return { posted: posted.count ?? 0, pending: pending.count ?? 0, delivered: delivered.count ?? 0 };
    },
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Hello{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {isDonor && <Badge variant="secondary">Donor</Badge>}
            {isNgo && (
              <Badge variant={profile?.ngo_verified ? "default" : "outline"}>
                NGO {profile?.ngo_verified ? "· verified" : "· pending verification"}
              </Badge>
            )}
            {isAdmin && <Badge>Admin</Badge>}
          </div>
        </div>
        {isDonor && (
          <Button asChild>
            <Link to="/donations/new">Post donation</Link>
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats && isAdmin && (() => {
          const s = stats as { total: number; delivered: number; ngos: number };
          return (<>
            <StatCard label="Total donations" value={s.total} />
            <StatCard label="Delivered" value={s.delivered} />
            <StatCard label="NGOs registered" value={s.ngos} />
          </>);
        })()}
        {stats && isNgo && !isAdmin && (() => {
          const s = stats as { available: number; mine: number; delivered: number };
          return (<>
            <StatCard label="Available now" value={s.available} />
            <StatCard label="My pickups" value={s.mine} />
            <StatCard label="Delivered" value={s.delivered} />
          </>);
        })()}
        {stats && !isNgo && !isAdmin && (() => {
          const s = stats as { posted: number; pending: number; delivered: number };
          return (<>
            <StatCard label="Donations posted" value={s.posted} />
            <StatCard label="Pending" value={s.pending} />
            <StatCard label="Delivered" value={s.delivered} />
          </>);
        })()}
      </div>

      {isNgo && !profile?.ngo_verified && (
        <Card className="mt-6 border-yellow-500/40 bg-yellow-500/5">
          <CardHeader><CardTitle className="text-base">Your NGO is awaiting verification</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Once an admin verifies your NGO, you'll be able to view and accept donations. Make sure your profile is complete.
            <div className="mt-3"><Button asChild size="sm" variant="outline"><Link to="/profile">Complete profile</Link></Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-3xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}
