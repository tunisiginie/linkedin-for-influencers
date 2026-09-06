import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_MODEL, NOLAN_SYSTEM_PROMPT, getClaudeClient } from "@/lib/claude";
import { SPONSORSHIP_INDUSTRY_KNOWLEDGE } from "@/lib/knowledge/sponsorship-industry";
import { executeSearchSite, SEARCH_SITE_TOOL } from "@/lib/nolan/tools";
import {
  getCreatorById,
  getNolanMessages,
  getNolanThread,
  getRateBenchmarks,
  searchCreators,
} from "@/lib/queries";
import { getMyClaimedCreator } from "@/lib/auth";
import { benchmarkRangesFor } from "@/lib/nolan/pricing";
import type { NolanThread } from "@/lib/types";

// Custom tools (search_site) require a client-side round trip mid-stream —
// unlike web_search, which Anthropic executes itself — so cap how many
// times a confused model can loop before we just answer with what we have.
const MAX_TOOL_ITERATIONS = 3;

/** Nolan's chat endpoint. Streams plain text back to the client.
 *
 * Auth is now optional (front-of-site overhaul, part 1): anyone can talk to
 * Nolan. Persistence still requires a claimed creator profile —
 * "claim to save" — so this route has three cases:
 *   - `threadId` given -> an existing thread; RLS (owns_nolan_thread)
 *     decides whether the caller can see it, same as before.
 *   - No `threadId`, but the caller is signed in with a claimed creator
 *     profile -> create a thread now, so even the first message is saved.
 *     Its id comes back via the `X-Nolan-Thread-Id` header for the client
 *     to hold onto for the next turn.
 *   - No `threadId`, anonymous or unclaimed -> ephemeral. Nothing is read
 *     or written to nolan_threads/nolan_messages.
 *
 * Falls back to `{ type: "fallback" }` (JSON, not a stream) when
 * ANTHROPIC_API_KEY isn't set, same convention as the other Claude routes. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let threadId: string | null;
  let messageBody: string;
  try {
    const body = await request.json();
    threadId = body?.threadId ? String(body.threadId) : null;
    messageBody = String(body?.message ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!messageBody) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  let thread: NolanThread | null = null;
  let creatorIdForContext: string | null = null;

  if (threadId) {
    // getNolanThread relies on RLS (owns_nolan_thread) to return null for a
    // thread that doesn't exist *or* isn't the caller's — same 404-either-way
    // convention as getConversationDetail, so as not to leak thread ids.
    thread = await getNolanThread(threadId);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    creatorIdForContext = thread.creator_id;
  } else if (user) {
    const myCreator = await getMyClaimedCreator();
    if (myCreator) {
      const { data: newThread, error } = await supabase
        .from("nolan_threads")
        .insert({ creator_id: myCreator.id })
        .select("*")
        .single();
      if (!error && newThread) {
        thread = newThread as NolanThread;
        threadId = newThread.id as string;
        creatorIdForContext = myCreator.id;
      }
    }
  }

  const isPersisted = thread !== null && threadId !== null;

  if (isPersisted) {
    // Persist the user's turn immediately, before calling Claude, so it's
    // never lost even if the model call fails.
    const { error: insertUserError } = await supabase
      .from("nolan_messages")
      .insert({ thread_id: threadId, role: "user", body: messageBody });
    if (insertUserError) {
      return NextResponse.json({ error: insertUserError.message }, { status: 500 });
    }
  }

  const client = getClaudeClient();
  if (!client) return NextResponse.json({ type: "fallback" });

  const [creator, history] = await Promise.all([
    creatorIdForContext ? getCreatorById(creatorIdForContext) : Promise.resolve(null),
    isPersisted ? getNolanMessages(threadId!) : Promise.resolve([]),
  ]);

  // Lightweight peer grounding from the platform's own data — a handful of
  // other creators in the same primary category, ranked by JAE Score. Not a
  // rigorous benchmark (see computeCategoryBenchmark in roi/score.ts for
  // that), just enough for Nolan to say something concrete without ever
  // inventing an external market rate.
  let peerContextLine: string | null = null;
  if (creator) {
    const primaryCategory = [...creator.creator_categories].sort(
      (a, b) => b.confidence - a.confidence,
    )[0];
    if (primaryCategory?.categories?.slug) {
      const { creators: peers } = await searchCreators({
        category: primaryCategory.categories.slug,
        sort: "roi",
        limit: 6,
      });
      const others = peers.filter((p) => p.id !== creator.id && p.roi_scores?.score != null);
      if (others.length > 0) {
        const avgScore = Math.round(
          others.reduce((s, p) => s + (p.roi_scores!.score ?? 0), 0) / others.length,
        );
        const avgFollowers = Math.round(
          others.reduce((s, p) => s + (p.reach?.total_followers ?? 0), 0) / others.length,
        );
        peerContextLine = `For rough context only: other ${primaryCategory.categories.name} creators on this platform average a JAE Score around ${avgScore}/1000 and ${avgFollowers.toLocaleString()} followers (small in-platform sample, not an external market rate).`;
      }
    }
  }

  const topPositive = (creator?.roi_scores?.reasons ?? [])
    .filter((r) => r.direction === "positive")
    .slice(0, 2)
    .map((r) => r.label)
    .join("; ");
  const topNegative = (creator?.roi_scores?.reasons ?? [])
    .filter((r) => r.direction === "negative")
    .slice(0, 2)
    .map((r) => r.label)
    .join("; ");
  const primaryAccount =
    creator?.creator_accounts.find((a) => a.is_primary) ?? creator?.creator_accounts[0];
  const latestMetrics = primaryAccount?.account_metrics.at(-1);

  // Pricing context (Nolan v2 Phase C3-C4): real ingredients, not a
  // pre-computed verdict. The creator's own median recent views (never
  // follower count — the knowledge base's rule 3) plus every matching
  // rate_benchmarks source kept separate, exactly as
  // benchmarkRangesFor() returns them. Nolan's own system prompt does the
  // range-narrowing reasoning from here, citing sources — deliberately not
  // pre-collapsed into one number server-side.
  let pricingContextLine: string | null = null;
  if (primaryAccount && latestMetrics) {
    const recentViews = primaryAccount.account_metrics
      .slice(-20)
      .map((m) => m.avg_views)
      .filter((v): v is number => typeof v === "number" && v > 0)
      .sort((a, b) => a - b);
    const medianViews =
      recentViews.length > 0 ? recentViews[Math.floor(recentViews.length / 2)] : null;

    const platformSlug = primaryAccount.platforms?.slug;
    if (platformSlug) {
      const benchmarks = await getRateBenchmarks(platformSlug);
      const ranges = benchmarkRangesFor(benchmarks, platformSlug, latestMetrics.followers ?? 0);
      if (ranges.length > 0) {
        const rangeLines = ranges.map((r) => {
          const high = r.highCents != null ? `$${(r.highCents / 100).toLocaleString()}` : "open-ended";
          const tierNote = r.tierMatched ? "" : ` (${r.tierLabel}, not tier-matched)`;
          return `- ${r.source}: $${(r.lowCents / 100).toLocaleString()}-${high}${tierNote}${r.methodologyNote ? ` — ${r.methodologyNote}` : ""}`;
        });
        pricingContextLine = [
          `Rate benchmark data for ${primaryAccount.platforms?.name ?? platformSlug} at this creator's size:`,
          ...rangeLines,
          medianViews != null
            ? `This creator's own median avg views over their last ${recentViews.length} recorded posts: ${medianViews.toLocaleString()}.`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  const creatorContextLines = creator
    ? [
        `You're talking with ${creator.display_name}${creator.headline ? ` (${creator.headline})` : ""}.`,
        creator.roi_scores?.score != null
          ? `Their JAE Score: ${creator.roi_scores.score}/1000 (grade ${creator.roi_scores.grade}, confidence ${creator.roi_scores.confidence != null ? Math.round(creator.roi_scores.confidence * 100) + "%" : "n/a"}).${topPositive ? ` Strongest factors: ${topPositive}.` : ""}${topNegative ? ` Weakest factors: ${topNegative}.` : ""}`
          : "JAE Score: not yet computed (needs at least 30 days of metrics history).",
        primaryAccount
          ? `Primary platform: ${primaryAccount.platforms?.name}, @${primaryAccount.handle}, ${latestMetrics?.followers ?? "unknown"} followers.`
          : null,
        peerContextLine,
        pricingContextLine,
      ]
        .filter(Boolean)
        .join("\n")
    : user
      ? "No creator profile context is available for this conversation."
      : "This visitor isn't signed in. No creator profile context is available — if they ask you to look something up, use search_site rather than assuming.";

  const priorMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.body,
  }));

  const conversation: Anthropic.MessageParam[] = [
    ...priorMessages,
    { role: "user", content: `${creatorContextLines}\n\n${messageBody}` },
  ];

  const encoder = new TextEncoder();
  let currentStream: ReturnType<typeof client.messages.stream> | null = null;

  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      let settled = false;
      const close = () => {
        if (settled) return;
        settled = true;
        controller.close();
      };

      let finalAssistantText = "";

      try {
        for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
          const stream = client.messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: 16000,
            thinking: { type: "adaptive" },
            // Two stable blocks, cache breakpoint on the second — both are
            // fixed text with no per-request/per-user content, so the
            // ~19K-token combined prefix (persona + knowledge base) is read
            // from cache on every message in a thread rather than re-billed
            // in full. Creator context (volatile) stays in the user turn,
            // after this breakpoint — see AGENTS.md on why order matters.
            system: [
              { type: "text", text: NOLAN_SYSTEM_PROMPT },
              {
                type: "text",
                text: SPONSORSHIP_INDUSTRY_KNOWLEDGE,
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: [
              { type: "web_search_20260209", name: "web_search", max_uses: 3 },
              SEARCH_SITE_TOOL,
            ],
            messages: conversation,
          });
          currentStream = stream;

          stream.on("text", (delta: string) => {
            controller.enqueue(encoder.encode(delta));
          });

          const message = await stream.finalMessage();
          const textBlocks = message.content.filter(
            (b): b is Anthropic.TextBlock => b.type === "text",
          );
          finalAssistantText += textBlocks.map((b) => b.text).join("");

          if (message.stop_reason !== "tool_use") break;

          const toolUses = message.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "search_site",
          );
          if (toolUses.length === 0) break;

          conversation.push({ role: "assistant", content: message.content });
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUses) {
            const resultText = await executeSearchSite(toolUse.input);
            toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: resultText });
          }
          conversation.push({ role: "user", content: toolResults });
          // Loop continues, opening a fresh stream that keeps writing into
          // the same controller — the client sees one continuous reply.
        }
      } catch (err) {
        console.error("nolan/chat stream error:", err);
        controller.enqueue(
          encoder.encode("\n\n_Nolan's response was interrupted — please try again._"),
        );
      }

      if (isPersisted && finalAssistantText) {
        try {
          await supabase
            .from("nolan_messages")
            .insert({ thread_id: threadId!, role: "assistant", body: finalAssistantText });
          await supabase
            .from("nolan_threads")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", threadId!);
        } catch (err) {
          console.error("nolan/chat failed to persist assistant message:", err);
        }
      }

      close();
    },
    cancel() {
      currentStream?.abort();
    },
  });

  return new Response(responseBody, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Nolan-Response": "stream",
      ...(isPersisted ? { "X-Nolan-Thread-Id": threadId! } : {}),
    },
  });
}
