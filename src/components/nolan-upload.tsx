"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContractSeverity, NolanDocument } from "@/lib/types";

const SEVERITY_VARIANT: Record<ContractSeverity, "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  caution: "outline",
  warning: "destructive",
};

function ReviewCard({ document }: { document: NolanDocument }) {
  const review = document.review;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4 text-muted-foreground" />
          <span className="truncate">{document.file_name}</span>
        </div>

        {!review ? (
          <p className="text-xs text-muted-foreground">Not analyzed yet.</p>
        ) : (
          <>
            <p className="text-sm text-foreground/90">{review.summary}</p>

            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              {review.term ? (
                <div>
                  <dt className="text-muted-foreground">Term</dt>
                  <dd>{review.term}</dd>
                </div>
              ) : null}
              {review.compensation ? (
                <div>
                  <dt className="text-muted-foreground">Compensation</dt>
                  <dd>{review.compensation}</dd>
                </div>
              ) : null}
              {review.exclusivity ? (
                <div>
                  <dt className="text-muted-foreground">Exclusivity</dt>
                  <dd>{review.exclusivity}</dd>
                </div>
              ) : null}
              {review.usageRights ? (
                <div>
                  <dt className="text-muted-foreground">Usage rights</dt>
                  <dd>{review.usageRights}</dd>
                </div>
              ) : null}
              {review.ipAssignment ? (
                <div>
                  <dt className="text-muted-foreground">IP assignment</dt>
                  <dd>{review.ipAssignment}</dd>
                </div>
              ) : null}
              {review.termination ? (
                <div>
                  <dt className="text-muted-foreground">Termination</dt>
                  <dd>{review.termination}</dd>
                </div>
              ) : null}
            </dl>

            {review.deliverables.length > 0 ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Deliverables</p>
                <ul className="list-inside list-disc text-xs">
                  {review.deliverables.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {review.redFlags.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <AlertTriangle className="size-3.5" /> Worth a second look
                </p>
                {review.redFlags.map((flag, i) => (
                  <div key={i} className="flex flex-col gap-0.5 rounded-md border border-border p-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={SEVERITY_VARIANT[flag.severity]} className="text-[10px]">
                        {flag.severity}
                      </Badge>
                      <span className="text-xs font-medium">{flag.clause}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.explanation}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function NolanUpload({
  threadId,
  initialDocuments,
}: {
  threadId: string;
  initialDocuments: NolanDocument[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("threadId", threadId);
      formData.set("file", file);
      const res = await fetch("/api/nolan/analyze", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't analyze that file.");
        return;
      }
      if (data.type === "fallback") {
        toast.info("Uploaded, but Nolan isn't configured on this deployment yet to analyze it.");
      }
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't analyze that file.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-3 border-l border-border p-3">
      <div>
        <p className="mb-2 text-sm font-semibold">Contracts & screenshots</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className={cn("size-3.5", isUploading && "animate-pulse")} />
          {isUploading ? "Analyzing..." : "Upload PDF or image"}
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Nolan reads the terms and flags what&apos;s worth a second look. Educational, not
          legal advice.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing uploaded in this conversation yet.</p>
        ) : (
          documents.map((doc) => <ReviewCard key={doc.id} document={doc} />)
        )}
      </div>
    </div>
  );
}
