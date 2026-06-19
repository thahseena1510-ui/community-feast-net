import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — FoodShare" }] }),
  component: Admin,
});

function Admin() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const { data: ngos } = useQuery({
    queryKey: ["admin-ngos"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,ngo_name,ngo_verified,phone,address").not("ngo_name", "is", null).order("ngo_verified", { ascending: true })).data ?? [],
    enabled: isAdmin,
  });

  const { data: donations } = useQuery({
    queryKey: ["admin-donations"],
    queryFn: async () => (await supabase.from("donations").select("id,food_name,status,created_at,pickup_address").order("created_at", { ascending: false }).limit(50)).data ?? [],
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">Admin access required.</div>;
  }

  async function setVerified(id: string, value: boolean) {
    const { error } = await supabase.from("profiles").update({ ngo_verified: value }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(value ? "NGO verified" : "Verification revoked"); qc.invalidateQueries({ queryKey: ["admin-ngos"] }); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verify NGOs and oversee donations.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">NGOs</h2>
        <div className="space-y-2">
          {ngos?.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">{n.ngo_name}</div>
                  <div className="text-sm text-muted-foreground">{n.full_name} · {n.phone ?? "no phone"}</div>
                </div>
                <div className="flex items-center gap-2">
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

      <section>
        <h2 className="mb-3 text-lg font-medium">Recent donations</h2>
        <div className="space-y-2">
          {donations?.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">{d.food_name}</div>
                  <div className="text-sm text-muted-foreground">{d.pickup_address}</div>
                </div>
                <Badge variant="outline">{d.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
