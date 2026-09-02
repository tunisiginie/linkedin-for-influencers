import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_MODEL, NOLAN_SYSTEM_PROMPT, getClaudeClient } from "@/lib/claude";
import { getNolanThread } from "@/lib/queries";
import type { ContractReview } from "@/lib/types";

const ACCEPTED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024; // 15MB — well under the API's 32MB request cap

const CONTRACT_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    parties: { type: "array", items: { type: "string" } },
    term: { type: "string" },
    compensation: { type: "string" },
    deliverables: { type: "array", items: { type: "string" } },
    exclusivity: { type: "string" },
    usageRights: { type: "string" },
    ipAssignment: { type: "string" },
    termination: { type: "string" },
    redFlags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clause: { type: "string" },
          severity: { type: "string", enum: ["info", "caution", "warning"] },
          explanation: { type: "string" },
        },
        required: ["clause", "severity", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "summary",
    "parties",
    "term",
    "compensation",
    "deliverables",
    "exclusivity",
    "usageRights",
    "ipAssignment",
    "termination",
    "redFlags",
  ],
  additionalProperties: false,
} as const;

/** Empty string -> null for the review's optional plain-language fields;
 * structured-output schemas here require every property, but "not present
 * in this document" is more honestly modeled as null than as "". */
function nullifyEmpty(value: string): string | null {
  return value.trim() ? value : null;
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
      max_tokens: 4096,
      system: [
        { type: "text", text: NOLAN_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: [
            fileContentBlock,
            {
              type: "text",
              text: "This is a sponsorship contract or an outreach message screenshot. Extract its terms into the structured review format. Use plain language, not legal jargon. If a field genuinely isn't present in the document, return an empty string for it rather than guessing. Flag anything worth a second look in redFlags — exclusivity windows, perpetual or overly broad usage rights, unclear or delayed payment terms, one-sided termination, IP assignment beyond the sponsored content itself — each with a severity and a plain explanation of why it matters.",
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
      parties: string[];
      term: string;
      compensation: string;
      deliverables: string[];
      exclusivity: string;
      usageRights: string;
      ipAssignment: string;
      termination: string;
      redFlags: ContractReview["redFlags"];
    };

    const review: ContractReview = {
      summary: raw.summary,
      parties: raw.parties,
      term: nullifyEmpty(raw.term),
      compensation: nullifyEmpty(raw.compensation),
      deliverables: raw.deliverables,
      exclusivity: nullifyEmpty(raw.exclusivity),
      usageRights: nullifyEmpty(raw.usageRights),
      ipAssignment: nullifyEmpty(raw.ipAssignment),
      termination: nullifyEmpty(raw.termination),
      redFlags: raw.redFlags,
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
