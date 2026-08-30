"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Sparkles } from "lucide-react";
import type { CreatorDocument, DocumentKind } from "@/lib/types";

const KIND_LABELS: Record<DocumentKind, string> = {
  campaign_brief: "Campaign brief",
  term_sheet: "Term sheet",
  insertion_order: "Insertion order",
  deliverables_schedule: "Deliverables schedule",
};

const KIND_ITEMS = Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }));

function DocumentContent({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-2 text-sm">
      {Object.entries(content)
        .filter(([key]) => key !== "title")
        .map(([key, value]) => (
          <div key={key}>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {key.replace(/([A-Z])/g, " $1")}
            </div>
            {Array.isArray(value) ? (
              <ul className="list-disc space-y-0.5 pl-4">
                {value.map((item, i) => (
                  <li key={i}>
                    {typeof item === "object" && item !== null
                      ? Object.entries(item as Record<string, unknown>)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")
                      : String(item)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="whitespace-pre-line">{String(value)}</p>
            )}
          </div>
        ))}
    </div>
  );
}

export function DocumentsPanel({
  conversationId,
  initialDocuments,
}: {
  conversationId: string;
  initialDocuments: CreatorDocument[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [viewing, setViewing] = useState<CreatorDocument | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [kind, setKind] = useState<DocumentKind>("campaign_brief");
  const [brief, setBrief] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, kind, brief }),
      });
      const data = await res.json();
      if (data.type === "fallback") {
        toast.info("Claude isn't configured on this deployment yet.");
        return;
      }
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        setGenerateOpen(false);
        setBrief("");
        toast.success("Document generated.");
      } else {
        toast.error(data.error ?? "Failed to generate document.");
      }
    } catch {
      toast.error("Failed to generate document.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border p-3 lg:flex">
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogTrigger render={<Button size="sm"><Sparkles className="size-3.5" /> Generate document</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate a document</DialogTitle>
            <DialogDescription>
              Claude drafts a starting point from this conversation&apos;s context.
              Review before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select items={KIND_ITEMS} value={kind} onValueChange={(v) => v && setKind(v as DocumentKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_ITEMS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Optional: any specifics to include (budget, deliverables, dates)..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {documents.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">No documents yet.</p>
      ) : (
        documents.map((doc) => (
          <Card
            key={doc.id}
            className="cursor-pointer gap-2 py-3 transition-colors hover:bg-accent"
            onClick={() => setViewing(doc)}
          >
            <CardHeader className="px-3">
              <CardTitle className="flex items-start gap-1.5 text-xs">
                <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{doc.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              <Badge variant="secondary" className="text-[10px]">
                {KIND_LABELS[doc.kind]}
              </Badge>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.title}</DialogTitle>
                <DialogDescription>{KIND_LABELS[viewing.kind]} · draft</DialogDescription>
              </DialogHeader>
              <DocumentContent content={viewing.content} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
