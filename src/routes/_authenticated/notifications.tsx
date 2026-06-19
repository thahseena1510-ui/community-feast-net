import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — FoodShare" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const { data, refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => (await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100)).data ?? [],
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    // mark all as read
    supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false).then(() => refetch());
  }, [user, refetch]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <div className="mt-6 space-y-2">
        {(!data || data.length === 0) && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 h-6 w-6" />No notifications yet.
          </CardContent></Card>
        )}
        {data?.map((n) => (
          <Card key={n.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-sm text-muted-foreground">{n.body}</div>}
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {n.donation_id && (
                  <Link to="/donations/$id" params={{ id: n.donation_id }} className="text-sm font-medium text-primary hover:underline">
                    View
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
