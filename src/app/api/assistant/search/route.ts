import { NextResponse, type NextRequest } from "next/server";
import { CLAUDE_MODEL, PLATFORM_SYSTEM_PROMPT, getClaudeClient } from "@/lib/claude";
import { getCategories, getPlatforms } from "@/lib/queries";

/** Natural-language talent search: Claude turns a sentence like "fitness
 * creators under 500k subs in the UK who are growing" into the same facet
 * filters the manual search sidebar produces. Mirrors the voice-concierge
 * tool-use pattern from the Rentapro sibling project. */
export async function POST(request: NextRequest) {
  const client = getClaudeClient();
  if (!client) return NextResponse.json({ type: "fallback" });

  let query: string;
  try {
    const body = await request.json();
    query = String(body?.query ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const [categories, platforms] = await Promise.all([getCategories(), getPlatforms()]);
  const categorySlugs = categories.map((c) => c.slug);
  const platformSlugs = platforms.map((p) => p.slug);

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: [
        { type: "text", text: PLATFORM_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: query }],
      tool_choice: { type: "tool", name: "search_creators" },
      tools: [
        {
          name: "search_creators",
          description:
            "Search the creator directory using structured filters extracted from the sponsor's natural-language request.",
          strict: true,
          input_schema: {
            type: "object",
            properties: {
              q: { type: "string", description: "Free-text keyword search (name/headline/bio), or empty string." },
              category: {
                type: "string",
                enum: [...categorySlugs, ""],
                description: "Category slug, or empty string if no specific category was mentioned.",
              },
              platform: {
                type: "string",
                enum: [...platformSlugs, ""],
                description: "Platform slug, or empty string if no specific platform was mentioned.",
              },
              country: { type: "string", description: "Two-letter country code, or empty string." },
              minFollowers: { type: "number", description: "Minimum follower count, or 0 if unspecified." },
              maxFollowers: { type: "number", description: "Maximum follower count, or 0 if unspecified." },
              minRoiScore: { type: "number", description: "Minimum ROI score 0-1000, or 0 if unspecified." },
              sort: {
                type: "string",
                enum: ["roi", "followers", "newest"],
                description: "How to sort results. Default to roi.",
              },
            },
            required: [
              "q",
              "category",
              "platform",
              "country",
              "minFollowers",
              "maxFollowers",
              "minRoiScore",
              "sort",
            ],
            additionalProperties: false,
          },
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Claude did not return search filters." }, { status: 502 });
    }

    return NextResponse.json({ filters: toolUse.input });
  } catch (err) {
    console.error("assistant/search failed:", err);
    return NextResponse.json({ error: "Search assistant failed." }, { status: 502 });
  }
}
