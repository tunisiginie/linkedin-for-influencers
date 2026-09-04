import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_MODEL, NOLAN_SYSTEM_PROMPT, getClaudeClient } from "@/lib/claude";
import { SPONSORSHIP_INDUSTRY_KNOWLEDGE } from "@/lib/knowledge/sponsorship-industry";
import { getNolanThread } from "@/lib/queries";
import type { ContractReview } from "@/lib/types";

const ACCEPTED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024; // 15MB — well under the API's 32MB request cap

// Nolan v2 (Phase C5) clause-risk model, adapted from the knowledge base's
// core clause matrix (src/lib/knowledge/sponsorship-industry.ts). Note:
// output_config.format's json_schema does NOT support `minimum`/`maximum`
// on integer properties (discovered as a live 400 invalid_request_error in
// Phase B — see content-signals.ts) — this schema uses only string/enum/
// array/boolean types, so that restriction doesn't apply here, but keep it
// in mind before adding any bounded numeric field to a structured-output
// schema in this codebase.
const RIGHTS_SCHEMA = {
  type: "object",
  properties: {
    media: { type: "string" },
    territory: { type: "string" },
    term: { type: "string" },
    sublicensing: { type: "string" },
    editingDerivatives: { type: "string" },
    nameLikenessVoice: { type: "string" },
    aiSyntheticReplica: { type: "string" },
    whitelistingPaidMedia: { type: "string" },
    postTerminationUse: { type: "string" },
    renewal: { type: "string" },
  },
  required: [
    "media",
    "territory",
    "term",
    "sublicensing",
    "editingDerivatives",
    "nameLikenessVoice",
    "aiSyntheticReplica",
    "whitelistingPaidMedia",
    "postTerminationUse",
    "renewal",
  ],
  additionalProperties: false,
} as const;

const CONTRACT_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    overallRisk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    recommendation: { type: "string", enum: ["ACCEPT", "COUNTER", "DECLINE", "COUNSEL_REVIEW"] },
    parties: { type: "array", items: { type: "string" } },
    term: { type: "string" },
    compensation: { type: "string" },
    deliverables: { type: "array", items: { type: "string" } },
    rights: RIGHTS_SCHEMA,
    clauseRisks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clause: { type: "string" },
          currentLanguage: { type: "string" },
          risk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          why: { type: "string" },
          whoControlsRisk: { type: "string", enum: ["creator", "brand", "shared"] },
          proposedMitigation: { type: "string" },
          counselReview: { type: "boolean" },
        },
        required: [
          "clause",
          "currentLanguage",
          "risk",
          "why",
          "whoControlsRisk",
          "proposedMitigation",
          "counselReview",
        ],
        additionalProperties: false,
      },
    },
    complianceChecks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          issue: { type: "string" },
          status: { type: "string", enum: ["ok", "concern", "unclear", "not_applicable"] },
          requiredAction: { type: "string" },
          source: { type: "string" },
        },
        required: ["issue", "status", "requiredAction", "source"],
        additionalProperties: false,
      },
    },
    assumptionsOrMissingData: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "overallRisk",
    "recommendation",
    "parties",
    "term",
    "compensation",
    "deliverables",
    "rights",
    "clauseRisks",
    "complianceChecks",
    "assumptionsOrMissingData",
  ],
  additionalProperties: false,
} as const;

const CLAUSE_CATEGORIES = [
  "Deliverables",
  "Approval / revisions",
  "Compensation",
  "Payment terms",
  "Usage rights",
  "IP ownership",
  "Exclusivity",
  "Disclosure",
  "Claims / substantiation",
  "KPI / makegood",
  "Kill fee / cancellation",
  "Indemnity / limitation of liability",
  "Termination",
  "Governing law / dispute resolution",
];

const COMPLIANCE_ISSUES = [
  "FTC material-connection disclosure",
  "Platform paid-promotion / branded-content tool requirement",
  "Claims substantiation",
  "COPPA (content directed to children under 13)",
  "GDPR / privacy data flow",
];

/** Empty string -> null for the review's optional plain-language fields;
 * structured-output schemas here require every property, but "not present
 * in this document" is more honestly modeled as null than as "". */
function nullifyEmpty(value: string): string | null {
  return value.trim() ? value : null;
}

function nullifyEmptyRights(raw: Record<string, string>): ContractReview["rights"] {
  const out = {} as ContractReview["rights"];
  for (const key of Object.keys(raw) as (keyof ContractReview["rights"])[]) {
    out[key] = nullifyEmpty(raw[key]);
  }
  return out;
}

/** Analyzes an uploaded sponsorship contract or screenshot: stores the
 * original file in the private nolan-uploads bucket, then extracts a
 * structured, plain-language review via output_config.format. Citations are
 * deliberately not used here — they're incompatible with structured output
 * (400) — so this is a single extraction pass, not a cited Q&A. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const threadId = String(formData.get("threadId") ?? "");
  const file = formData.get("file");
  if (!threadId || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing threadId or file" }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type — upload a PDF, PNG, JPEG, or WebP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (15MB max)." }, { status: 400 });
  }

  const thread = await getNolanThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storagePath = `${user.id}/${threadId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("nolan-uploads")
    .upload(storagePath, bytes, { contentType: file.type });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const client = getClaudeClient();
  if (!client) {
    // Still record the upload even without Claude configured — the review
    // stays null and the UI shows "not analyzed yet".
    const { data: doc } = await supabase
      .from("nolan_documents")
      .insert({
        thread_id: threadId,
        storage_path: storagePath,
        file_name: file.name,
        media_type: file.type,
      })
      .select("*")
      .single();
    return NextResponse.json({ type: "fallback", document: doc ?? null });
  }

  const base64 = Buffer.from(bytes).toString("base64");
  const fileContentBlock =
    file.type === "application/pdf"
      ? ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        } as const)
      : ({
          type: "image",
          source: {
            type: "base64",
            media_type: file.type as "image/png" | "image/jpeg" | "image/webp",
            data: base64,
          },
        } as const);

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      // Nolan v2's clause-risk table covers 14 clause categories plus
      // rights extraction and 5 compliance checks — 4096 truncated this
      // mid-JSON in live testing (verified: an "Unterminated string" parse
      // error, not a schema problem). Non-streaming, so keep this comfortably
      // under the ~16K ceiling the claude-api skill flags as needing
      // streaming to avoid HTTP timeouts.
      max_tokens: 8192,
      // Same two-block cache placement as /api/nolan/chat — see the
      // comment there.
      system: [
        { type: "text", text: NOLAN_SYSTEM_PROMPT },
        { type: "text", text: SPONSORSHIP_INDUSTRY_KNOWLEDGE, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: [
            fileContentBlock,
            {
              type: "text",
              text: `This is a sponsorship contract or an outreach message screenshot. Extract its terms and analyze its risk into the structured review format. Use plain language, not legal jargon. If a field genuinely isn't present in the document, return an empty string for it rather than guessing.

For clauseRisks, include one entry for each of these categories, even when the document is silent on it (silence is itself often the risk — e.g. no kill fee): ${CLAUSE_CATEGORIES.join(", ")}. For each, say what the document currently allows (or "Not addressed in this document"), the risk level, why it matters in practice, who bears the resulting risk if things go wrong, and what a more balanced version would say.

For complianceChecks, include one entry for each of: ${COMPLIANCE_ISSUES.join(", ")}. Mark "not_applicable" when a check genuinely doesn't apply (e.g. no children's content involved), not when you're just unsure — use "unclear" for that instead.

For rights, extract each dimension separately — do not let a broad "usage rights" grant hide sublicensing, AI/synthetic-replica use, or post-termination use inside one field.

overallRisk and recommendation should reflect the clauseRisks you found, not a separate judgment. List anything you had to assume or couldn't determine from the document in assumptionsOrMissingData.`,
            },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: CONTRACT_REVIEW_SCHEMA } },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Nolan returned no review." }, { status: 502 });
    }

    const raw = JSON.parse(textBlock.text) as {
      summary: string;
      overallRisk: ContractReview["overallRisk"];
      recommendation: ContractReview["recommendation"];
      parties: string[];
      term: string;
      compensation: string;
      deliverables: string[];
      rights: Record<keyof ContractReview["rights"], string>;
      clauseRisks: (Omit<ContractReview["clauseRisks"][number], "currentLanguage"> & {
        currentLanguage: string;
      })[];
      complianceChecks: (Omit<
        ContractReview["complianceChecks"][number],
        "requiredAction" | "source"
      > & { requiredAction: string; source: string })[];
      assumptionsOrMissingData: string[];
    };

    const review: ContractReview = {
      summary: raw.summary,
      overallRisk: raw.overallRisk,
      recommendation: raw.recommendation,
      parties: raw.parties,
      term: nullifyEmpty(raw.term),
      compensation: nullifyEmpty(raw.compensation),
      deliverables: raw.deliverables,
      rights: nullifyEmptyRights(raw.rights),
      clauseRisks: raw.clauseRisks,
      complianceChecks: raw.complianceChecks.map((c) => ({
        ...c,
        requiredAction: nullifyEmpty(c.requiredAction),
        source: nullifyEmpty(c.source),
      })),
      assumptionsOrMissingData: raw.assumptionsOrMissingData,
    };

    const { data: document, error } = await supabase
      .from("nolan_documents")
      .insert({
        thread_id: threadId,
        storage_path: storagePath,
        file_name: file.name,
        media_type: file.type,
        review,
      })
      .select("*")
      .single();
    if (error || !document) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save the review." },
        { status: 500 },
      );
    }

    return NextResponse.json({ document });
  } catch (err) {
    console.error("nolan/analyze failed:", err);
    return NextResponse.json({ error: "Failed to analyze the document." }, { status: 502 });
  }
}
