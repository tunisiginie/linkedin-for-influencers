import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_MODEL, PLATFORM_SYSTEM_PROMPT, getClaudeClient } from "@/lib/claude";
import { getCreatorById, getOrgIdForUser, getOrganizationById } from "@/lib/queries";

/** Drafts a first-outreach message from a sponsor to a creator. Returns a
 * plain draft the sponsor edits before sending — nothing here ever sends a
 * message on its own. Falls back gracefully when ANTHROPIC_API_KEY isn't set. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = getClaudeClient();
  if (!client) return NextResponse.json({ type: "fallback" });

  let creatorId: string;
  try {
    const body = await request.json();
    creatorId = String(body?.creatorId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!creatorId) return NextResponse.json({ error: "Missing creatorId" }, { status: 400 });

  const creator = await getCreatorById(creatorId);
  if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  const orgId = await getOrgIdForUser(user.id);
  const org = orgId ? await getOrganizationById(orgId) : null;

  const primaryAccount = creator.creator_accounts.find((a) => a.is_primary) ?? creator.creator_accounts[0];
  const latestMetrics = primaryAccount?.account_metrics.at(-1);
  const topReasons = (creator.roi_scores?.reasons ?? [])
    .filter((r) => r.direction === "positive")
    .slice(0, 2)
    .map((r) => r.label)
    .join("; ");

  const contextLines = [
    `Creator: ${creator.display_name}`,
    creator.headline ? `Headline: ${creator.headline}` : null,
    creator.bio ? `Bio: ${creator.bio}` : null,
    creator.creator_categories.length
      ? `Content categories: ${creator.creator_categories.map((c) => c.categories?.name).filter(Boolean).join(", ")}`
      : null,
    creator.roi_scores?.score != null
      ? `ROI score: ${creator.roi_scores.score}/1000 (grade ${creator.roi_scores.grade}).${topReasons ? ` Strongest factors: ${topReasons}.` : ""}`
      : "ROI score: not yet computed (insufficient history).",
    primaryAccount
      ? `Primary platform: ${primaryAccount.platforms?.name}, @${primaryAccount.handle}, ${latestMetrics?.followers ?? "unknown"} followers.`
      : null,
    org ? `Sponsor organization: ${org.name}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: PLATFORM_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Draft a short, warm, professional first-outreach message from the sponsor to the creator below. 3-5 sentences. Reference something specific about their content or metrics (from the context — never invent details). No hard sales pitch, no exclamation-point overload. End with a soft, low-pressure call to action (e.g. asking if they're open to a conversation about a collaboration).\n\n${contextLines}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { draft: { type: "string" } },
            required: ["draft"],
            additionalProperties: false,
          },
        },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Claude returned no draft." }, { status: 502 });
    }
    const parsed = JSON.parse(textBlock.text) as { draft: string };
    return NextResponse.json({ draft: parsed.draft });
  } catch (err) {
    console.error("assistant/outreach failed:", err);
    return NextResponse.json({ error: "Failed to generate draft." }, { status: 502 });
  }
}
