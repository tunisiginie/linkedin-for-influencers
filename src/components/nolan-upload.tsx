"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContractRecommendation, ContractRiskLevel, NolanDocument } from "@/lib/types";

const RISK_VARIANT: Record<ContractRiskLevel, "secondary" | "outline" | "destructive"> = {
  LOW: "secondary",
  MEDIUM: "outline",
  HIGH: "destructive",
  CRITICAL: "destructive",
};

const RECOMMENDATION_LABEL: Record<ContractRecommendation, string> = {
  ACCEPT: "Accept",
  COUNTER: "Counter",
  DECLINE: "Decline",
  COUNSEL_REVIEW: "Get counsel review",
};

const RIGHTS_LABELS: Record<string, string> = {
  media: "Media",
  territory: "Territory",
  term: "Term",
  sublicensing: "Sublicensing",
  editingDerivatives: "Editing / derivatives",
  nameLikenessVoice: "Name / likeness / voice",
  aiSyntheticReplica: "AI / synthetic replica",
  whitelistingPaidMedia: "Whitelisting / paid media",
  postTerminationUse: "Post-termination use",
  renewal: "Renewal",
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
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={RISK_VARIANT[review.overallRisk]} className="text-[10px]">
                {review.overallRisk} risk
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {RECOMMENDATION_LABEL[review.recommendation]}
              </Badge>
            </div>

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

            {Object.entries(review.rights).some(([, v]) => v) ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Rights granted</p>
                <dl className="grid grid-cols-1 gap-1 text-xs">
                  {Object.entries(review.rights)
                    .filter(([, v]) => v)
                    .map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-0.5 rounded-md border border-border p-1.5">
                        <dt className="font-medium">{RIGHTS_LABELS[key] ?? key}</dt>
                        <dd className="text-muted-foreground">{value}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            ) : null}

            {review.clauseRisks.some((c) => c.risk !== "LOW") ? (
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <AlertTriangle className="size-3.5" /> Worth a second look
                </p>
                {review.clauseRisks
                  .filter((c) => c.risk !== "LOW")
                  .map((clause, i) => (
                    <div key={i} className="flex flex-col gap-1 rounded-md border border-border p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={RISK_VARIANT[clause.risk]} className="text-[10px]">
                          {clause.risk}
                        </Badge>
                        <span className="text-xs font-medium">{clause.clause}</span>
                        {clause.counselReview ? (
                          <Badge variant="outline" className="text-[10px]">
                            Counsel review
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{clause.why}</p>
                      <p className="text-xs">
                        <span className="font-medium">Suggested:</span> {clause.proposedMitigation}
                      </p>
                    </div>
                  ))}
              </div>
            ) : null}

            {review.complianceChecks.some((c) => c.status === "concern" || c.status === "unclear") ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Compliance</p>
                {review.complianceChecks
                  .filter((c) => c.status === "concern" || c.status === "unclear")
                  .map((c, i) => (
                    <div key={i} className="flex flex-col gap-0.5 rounded-md border border-border p-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={c.status === "concern" ? "destructive" : "outline"} className="text-[10px]">
                          {c.status}
                        </Badge>
                        <span className="text-xs font-medium">{c.issue}</span>
                      </div>
                      {c.requiredAction ? <p className="text-xs text-muted-foreground">{c.requiredAction}</p> : null}
                    </div>
                  ))}
              </div>
            ) : null}

            {review.assumptionsOrMissingData.length > 0 ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Assumptions / missing data</p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {review.assumptionsOrMissingData.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
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
