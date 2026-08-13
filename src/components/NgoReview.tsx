import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Clock, FileText, Loader2, MapPin, Phone, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Ngo = {
  id: string;
  full_name: string | null;
  ngo_name: string | null;
  ngo_verified: boolean;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  ngo_doc_path: string | null;
  ngo_doc_uploaded_at: string | null;
  ngo_doc_note: string | null;
};

export function NgoReview() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: ngos, isLoading } = useQuery({
    queryKey: ["admin-ngos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,full_name,ngo_name,ngo_verified,phone,address,lat,lng,created_at,ngo_doc_path,ngo_doc_uploaded_at,ngo_doc_note",
        )
        .not("ngo_name", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ngo[];
    },
  });

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("ngo-documents").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Could not open this document.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const rejectDoc = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ ngo_verified: false, ngo_doc_note: note })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document rejected — the NGO can upload a new one.");
      qc.invalidateQueries({ queryKey: ["admin-ngos"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not reject the document."),
  });


  const setVerified = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("profiles").update({ ngo_verified: value }).eq("id", id);
      if (error) throw error;
      return { id, value };
    },
    onSuccess: ({ value }) => {
      toast.success(
        value
          ? "NGO verified — they can now see and accept donations."
          : "Verification revoked — this NGO can no longer accept donations.",
      );
      qc.invalidateQueries({ queryKey: ["admin-ngos"] });
      qc.invalidateQueries({ queryKey: ["admin-platform-stats"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not update verification status."),
  });

  const term = q.trim().toLowerCase();
  const match = (n: Ngo) =>
    !term ||
    [n.ngo_name, n.full_name, n.address, n.phone].some((v) => v?.toLowerCase().includes(term));

  const all = (ngos ?? []).filter(match);
  const pending = all.filter((n) => !n.ngo_verified);
  const verified = all.filter((n) => n.ngo_verified);

  function row(n: Ngo) {
    const complete = !!n.phone && !!n.address && n.lat != null && n.lng != null;
    const busy = setVerified.isPending && setVerified.variables?.id === n.id;
    return (
      <Card key={n.id}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{n.ngo_name}</span>
              <Badge variant={n.ngo_verified ? "default" : "outline"} className="gap-1">
                {n.ngo_verified ? <BadgeCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {n.ngo_verified ? "Verified" : "Pending"}
              </Badge>
              {!complete && <Badge variant="secondary">Incomplete profile</Badge>}
              <Badge variant={n.ngo_doc_path ? "outline" : "destructive"} className="gap-1">
                <FileText className="h-3 w-3" />
                {n.ngo_doc_path ? "Document uploaded" : "No document"}
              </Badge>
            </div>
            <div className="truncate text-sm text-muted-foreground">
              {n.full_name ?? "No contact name"} · registered{" "}
              {new Date(n.created_at).toLocaleDateString()}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {n.phone ?? "No phone"}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{n.address ?? "No address"}</span>
              </span>
            </div>
            {n.ngo_doc_path && (
              <p className="text-xs text-muted-foreground">
                Document submitted{" "}
                {n.ngo_doc_uploaded_at ? new Date(n.ngo_doc_uploaded_at).toLocaleString() : "recently"}
              </p>
            )}
            {n.ngo_doc_note && <p className="text-xs text-destructive">Rejected: {n.ngo_doc_note}</p>}
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {n.ngo_doc_path && (
              <Button size="sm" variant="secondary" onClick={() => openDoc(n.ngo_doc_path!)}>
                View document
              </Button>
            )}
            {n.ngo_doc_path && !n.ngo_verified && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const note = window.prompt("Why is this document rejected? The NGO will see this note.");
                  if (note && note.trim()) rejectDoc.mutate({ id: n.id, note: note.trim().slice(0, 300) });
                }}
              >
                Reject
              </Button>
            )}
            <Button
              size="sm"
              variant={n.ngo_verified ? "outline" : "default"}
              disabled={busy || (!n.ngo_verified && !n.ngo_doc_path)}
              title={!n.ngo_verified && !n.ngo_doc_path ? "This NGO has not uploaded a registration document yet" : undefined}
              onClick={() => setVerified.mutate({ id: n.id, value: !n.ngo_verified })}
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {n.ngo_verified ? "Unverify" : "Verify"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function list(items: Ngo[], empty: string) {
    if (isLoading) return <p className="text-sm text-muted-foreground">Loading NGOs…</p>;
    if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
    return <div className="space-y-2">{items.map(row)}</div>;
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">NGO verification</h2>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search NGOs"
            className="pl-8"
          />
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="verified">Verified ({verified.length})</TabsTrigger>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          {list(pending, "No NGOs waiting for review.")}
        </TabsContent>
        <TabsContent value="verified" className="mt-4">
          {list(verified, "No verified NGOs yet.")}
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          {list(all, "No NGOs registered yet.")}
        </TabsContent>
      </Tabs>
    </section>
  );
}
