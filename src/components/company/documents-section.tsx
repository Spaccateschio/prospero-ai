import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Trash2, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const DOC_TYPES = [
  { value: "visura", label: "Visura camerale" },
  { value: "bilancio", label: "Bilancio depositato" },
  { value: "atto", label: "Atto societario" },
  { value: "statuto", label: "Statuto" },
  { value: "altro", label: "Altro" },
] as const;

type DocType = (typeof DOC_TYPES)[number]["value"];

type CompanyDocument = {
  id: string;
  doc_type: DocType;
  title: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  document_date: string | null;
  notes: string | null;
  uploaded_by: string;
  created_at: string;
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`;
}

export function DocumentsSection({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const docsQuery = useQuery({
    queryKey: ["company-documents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_documents")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CompanyDocument[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (input: {
      file: File;
      doc_type: DocType;
      title: string;
      document_date: string;
      notes: string;
    }) => {
      if (!user) throw new Error("Non autenticato");
      const ext = input.file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-documents")
        .upload(path, input.file, {
          cacheControl: "3600",
          contentType: input.file.type || undefined,
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);

      const { error: dbErr } = await supabase.from("company_documents").insert({
        company_id: companyId,
        doc_type: input.doc_type,
        title: input.title.trim() || input.file.name,
        storage_path: path,
        file_size: input.file.size,
        mime_type: input.file.type || null,
        document_date: input.document_date || null,
        notes: input.notes.trim() || null,
        uploaded_by: user.id,
      });
      if (dbErr) {
        // rollback: rimuovi il file caricato
        await supabase.storage.from("company-documents").remove([path]);
        throw new Error(dbErr.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-documents", companyId] });
      toast.success("Documento caricato");
      setDialogOpen(false);
    },
    onError: (err) => toast.error("Upload fallito", { description: err instanceof Error ? err.message : "" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: CompanyDocument) => {
      await supabase.storage.from("company-documents").remove([doc.storage_path]);
      const { error } = await supabase.from("company_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-documents", companyId] });
      toast.success("Documento eliminato");
    },
    onError: (err) => toast.error("Eliminazione fallita", { description: err instanceof Error ? err.message : "" }),
  });

  async function handleDownload(doc: CompanyDocument) {
    const { data, error } = await supabase.storage
      .from("company-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error("Download fallito", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Documenti aziendali</h3>
          <p className="text-xs text-muted-foreground">
            Visure camerali, bilanci depositati, atti societari, statuto. Storage privato e cifrato.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Upload className="mr-2 h-4 w-4" /> Carica documento</Button>
          </DialogTrigger>
          <UploadDialog onSubmit={(v) => uploadMutation.mutate(v)} pending={uploadMutation.isPending} />
        </Dialog>
      </div>

      {docsQuery.isLoading ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : docsQuery.data?.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nessun documento caricato.
        </div>
      ) : (
        <div className="space-y-2">
          {docsQuery.data?.map((doc) => {
            const typeLabel = DOC_TYPES.find((t) => t.value === doc.doc_type)?.label ?? doc.doc_type;
            return (
              <div key={doc.id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{doc.title}</span>
                    <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(doc.file_size)} · caricato {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: it })}
                    {doc.document_date && ` · data documento ${new Date(doc.document_date).toLocaleDateString("it-IT")}`}
                  </div>
                  {doc.notes && <div className="mt-1 text-xs text-muted-foreground">{doc.notes}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} title="Scarica">
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (confirm(`Eliminare "${doc.title}"?`)) deleteMutation.mutate(doc);
                }} title="Elimina">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Prossimamente:</strong> integrazione automatica con Registro
        Imprese (Telemaco/InfoCamere) per scaricare visure e bilanci direttamente senza upload manuale.
      </div>
    </div>
  );
}

function UploadDialog({
  onSubmit, pending,
}: {
  onSubmit: (v: { file: File; doc_type: DocType; title: string; document_date: string; notes: string }) => void;
  pending: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("visura");
  const [title, setTitle] = useState("");
  const [docDate, setDocDate] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Carica documento</DialogTitle>
        <DialogDescription>PDF, immagini o file di testo. Max 20 MB.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">File</Label>
          <Input type="file" accept=".pdf,image/*,.doc,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo documento</Label>
          <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Titolo (opzionale)</Label>
          <Input placeholder={file?.name ?? "Visura camerale 2024"} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data documento (opzionale)</Label>
          <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Note (opzionale)</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            if (!file) {
              toast.error("Seleziona un file");
              return;
            }
            if (file.size > 20 * 1024 * 1024) {
              toast.error("Il file supera i 20 MB");
              return;
            }
            onSubmit({ file, doc_type: docType, title, document_date: docDate, notes });
          }}
          disabled={pending}
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Carica
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
