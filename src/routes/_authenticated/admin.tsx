import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { donationStatusLabel } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — FoodShare" }] }),
  component: Admin,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(45 93% 55%)",
  accepted: "hsl(210 90% 55%)",
  picked_up: "hsl(260 80% 60%)",
  delivered: "hsl(142 70% 45%)",
  cancelled: "hsl(0 75% 55%)",
};

function Admin() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const { data: stats } = useQuery({
    queryKey: ["admin-platform-stats"],
    queryFn: async () => (await supabase.rpc("get_platform_stats")).data?.[0] ?? null,
    enabled: isAdmin,
  });

  const { data: trends } = useQuery({
    queryKey: ["admin-trends"],
    queryFn: async () => (await supabase.rpc("get_donation_trends", { days: 30 })).data ?? [],
    enabled: isAdmin,
  });

  const { data: breakdown } = useQuery({
    queryKey: ["admin-breakdown"],
    queryFn: async () => (await supabase.rpc("get_status_breakdown")).data ?? [],
    enabled: isAdmin,
  });

  const { data: ngos } = useQuery({
    queryKey: ["admin-ngos"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,ngo_name,ngo_verified,phone,address").not("ngo_name", "is", null).order("ngo_verified", { ascending: true })).data ?? [],
    enabled: isAdmin,
  });

  const { data: donations } = useQuery({
    queryKey: ["admin-donations"],
    queryFn: async () => (await supabase.from("donations").select("id,food_name,status,created_at,pickup_address").order("created_at", { ascending: false }).limit(20)).data ?? [],
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">Admin access required.</div>;
  }

  async function setVerified(id: string, value: boolean) {
    const { error } = await supabase.from("profiles").update({ ngo_verified: value }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(value ? "NGO verified" : "Verification revoked");
      qc.invalidateQueries({ queryKey: ["admin-ngos"] });
    }
  }

  const trendData = (trends ?? []).map((t) => ({
    day: new Date(t.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    Posted: Number(t.posted),
    Delivered: Number(t.delivered),
  }));

  const pieData = (breakdown ?? []).map((b) => ({
    name: donationStatusLabel(b.status),
    value: Number(b.count),
    key: b.status,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section>
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform activity, NGO verifications and donation oversight.</p>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total donations" value={stats?.total_donations ?? 0} />
        <Kpi label="Meals delivered" value={stats?.delivered ?? 0} />
        <Kpi label="Verified NGOs" value={stats?.active_ngos ?? 0} />
        <Kpi label="In progress" value={stats?.in_progress ?? 0} />
      </section>

      {/* CHARTS */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Donations · last 30 days</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Posted" fill="hsl(210 90% 55%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Delivered" fill="hsl(142 70% 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Status breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                    {pieData.map((e) => (
                      <Cell key={e.key} fill={STATUS_COLORS[e.key] ?? "hsl(220 10% 60%)"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* NGOs */}
      <section>
        <h2 className="mb-3 text-lg font-medium">NGOs</h2>
        <div className="space-y-2">
          {ngos?.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{n.ngo_name}</div>
                  <div className="truncate text-sm text-muted-foreground">{n.full_name} · {n.phone ?? "no phone"}</div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Badge variant={n.ngo_verified ? "default" : "outline"}>{n.ngo_verified ? "Verified" : "Pending"}</Badge>
                  <Button size="sm" variant={n.ngo_verified ? "outline" : "default"} onClick={() => setVerified(n.id, !n.ngo_verified)}>
                    {n.ngo_verified ? "Revoke" : "Verify"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {ngos?.length === 0 && <p className="text-sm text-muted-foreground">No NGOs yet.</p>}
        </div>
      </section>

      {/* Recent donations */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Recent donations</h2>
        <div className="space-y-2">
          {donations?.map((d) => (
            <Link key={d.id} to="/donations/$id" params={{ id: d.id }}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.food_name}</div>
                    <div className="truncate text-sm text-muted-foreground">{d.pickup_address}</div>
                  </div>
                  <Badge variant="outline">{donationStatusLabel(d.status)}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | bigint }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-3xl font-semibold tabular-nums">{Number(value).toLocaleString()}</div></CardContent>
    </Card>
  );
}
