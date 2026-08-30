import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_MODEL, PLATFORM_SYSTEM_PROMPT, getClaudeClient } from "@/lib/claude";
import { getConversationDetail, getCreatorById, getOrganizationById } from "@/lib/queries";
import type { DocumentKind } from "@/lib/types";

interface SchemaSpec {
  instruction: string;
  schema: Record<string, unknown>;
}

const DOCUMENT_SPECS: Record<DocumentKind, SchemaSpec> = {
  campaign_brief: {
    instruction:
      "Write a campaign brief a sponsor would send a creator to kick off a sponsorship conversation: objective, target audience, key messages, requested deliverables, a rough timeline, a budget range, and how success will be measured.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        objective: { type: "string" },
        targetAudience: { type: "string" },
        keyMessages: { type: "array", items: { type: "string" } },
        deliverables: { type: "array", items: { type: "string" } },
        timeline: { type: "string" },
        budgetRange: { type: "string" },
        successMetrics: { type: "array", items: { type: "string" } },
      },
      required: [
        "title",
        "objective",
        "targetAudience",
        "keyMessages",
        "deliverables",
        "timeline",
        "budgetRange",
        "successMetrics",
      ],
      additionalProperties: false,
    },
  },
  term_sheet: {
    instruction:
      "Draft a plain-language sponsorship term sheet (not a binding legal contract) covering scope of work, compensation, exclusivity, usage rights, term length, and termination.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        scopeOfWork: { type: "string" },
        compensationAmount: { type: "string" },
        paymentSchedule: { type: "string" },
        exclusivity: { type: "string" },
        usageRights: { type: "string" },
        term: { type: "string" },
        terminationClause: { type: "string" },
      },
      required: [
        "title",
        "scopeOfWork",
        "compensationAmount",
        "paymentSchedule",
        "exclusivity",
        "usageRights",
        "term",
        "terminationClause",
      ],
      additionalProperties: false,
    },
  },
  insertion_order: {
    instruction:
      "Draft an insertion order for a single sponsored placement: platform, ad format, flight dates, cost, deliverables, and the approval process before it goes live.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        campaignName: { type: "string" },
        platform: { type: "string" },
        adFormat: { type: "string" },
        flightStart: { type: "string" },
        flightEnd: { type: "string" },
        cost: { type: "string" },
        deliverables: { type: "array", items: { type: "string" } },
        approvalProcess: { type: "string" },
      },
      required: [
        "title",
        "campaignName",
        "platform",
        "adFormat",
        "flightStart",
        "flightEnd",
        "cost",
        "deliverables",
        "approvalProcess",
      ],
      additionalProperties: false,
    },
  },
  deliverables_schedule: {
    instruction:
      "Draft a deliverables schedule listing each specific piece of content owed, its platform, a due date (relative, e.g. 'Week 2'), and any notes.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              deliverable: { type: "string" },
              platform: { type: "string" },
              dueDate: { type: "string" },
              notes: { type: "string" },
            },
            required: ["deliverable", "platform", "dueDate", "notes"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "items"],
      additionalProperties: false,
    },
  },
};

const VALID_KINDS = Object.keys(DOCUMENT_SPECS) as DocumentKind[];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = getClaudeClient();
  if (!client) return NextResponse.json({ type: "fallback" });

  let conversationId: string;
  let kind: DocumentKind;
  let brief: string;
  try {
    const body = await request.json();
    conversationId = String(body?.conversationId ?? "");
    kind = body?.kind as DocumentKind;
    brief = String(body?.brief ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!conversationId || !VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Missing or invalid conversationId/kind" }, { status: 400 });
  }

  // RLS returns null if the caller isn't a participant in this conversation.
  const conversation = await getConversationDetail(conversationId);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const [creator, org] = await Promise.all([
    getCreatorById(conversation.creator_id),
    getOrganizationById(conversation.org_id),
  ]);

  const spec = DOCUMENT_SPECS[kind];
  const contextLines = [
    `Sponsor organization: ${org?.name ?? "Unknown"}`,
    `Creator: ${creator?.display_name ?? "Unknown"}`,
    creator?.headline ? `Creator headline: ${creator.headline}` : null,
    creator?.roi_scores?.score != null
      ? `Creator ROI score: ${creator.roi_scores.score}/1000 (grade ${creator.roi_scores.grade})`
      : null,
    brief ? `Additional instructions from the sponsor: ${brief}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1536,
      system: [
        { type: "text", text: PLATFORM_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: `${spec.instruction}\n\n${contextLines}` }],
      output_config: { format: { type: "json_schema", schema: spec.schema } },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Claude returned no document." }, { status: 502 });
    }
    const content = JSON.parse(textBlock.text) as { title: string } & Record<string, unknown>;

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        conversation_id: conversationId,
        kind,
        title: content.title,
        content,
        status: "draft",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error || !document) {
      return NextResponse.json({ error: error?.message ?? "Failed to save document." }, { status: 500 });
    }

    return NextResponse.json({ document });
  } catch (err) {
    console.error("documents/generate failed:", err);
    return NextResponse.json({ error: "Failed to generate document." }, { status: 502 });
  }
}
