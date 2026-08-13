import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function NgoDocumentUpload({
  userId,
  path,
  uploadedAt,
  note,
  onUploaded,
}: {
  userId: string;
  path: string | null;
  uploadedAt: string | null;
  note?: string | null;
  onUploaded: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Upload a PDF, JPG, PNG or WEBP file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File must be smaller than 5 MB.");
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const objectPath = `${userId}/registration-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("ngo-documents")
      .upload(objectPath, file, { contentType: file.type, upsert: true });
    if (upErr) {
      setBusy(false);
      toast.error(
        upErr.message.toLowerCase().includes("policy")
          ? "You can only upload documents to your own organisation profile."
          : upErr.message,
      );
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ ngo_doc_path: objectPath, ngo_doc_uploaded_at: new Date().toISOString(), ngo_doc_note: null })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Document uploaded — an admin will review it shortly.");
    onUploaded(objectPath);
  }

  async function view() {
    if (!path) return;
    const { data, error } = await supabase.storage.from("ngo-documents").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Could not open the document. Try uploading it again.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <Label>Government registration document</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload your NGO registration certificate (12A/80G, Societies Act, Trust deed or equivalent). PDF or image, max
        5 MB. Only you and platform admins can see it.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
          {path ? "Replace document" : "Upload document"}
        </Button>
        {path && (
          <Button type="button" variant="ghost" onClick={view}>
            View uploaded document
          </Button>
        )}
      </div>

      {path ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileCheck2 className="h-3.5 w-3.5" />
          Uploaded {uploadedAt ? new Date(uploadedAt).toLocaleString() : "recently"} · awaiting or completed admin review
        </p>
      ) : (
        <p className="mt-2 text-xs text-destructive">Required before an admin can verify your organisation.</p>
      )}

      {note && (
        <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          Admin note: {note}
        </p>
      )}
    </div>
  );
}
