import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_MODEL, NOLAN_SYSTEM_PROMPT, getClaudeClient } from "@/lib/claude";
import { SPONSORSHIP_INDUSTRY_KNOWLEDGE } from "@/lib/knowledge/sponsorship-industry";
import { getCreatorById, getNolanMessages, getNolanThread, getRateBenchmarks, searchCreators } from "@/lib/queries";
import { benchmarkRangesFor } from "@/lib/nolan/pricing";

/** Nolan's chat endpoint. Streams plain text back to the client and persists
 * both sides of the exchange server-side once the stream ends — the client
 * never has to re-POST the assistant's reply. Falls back to
 * `{ type: "fallback" }` (JSON, not a stream) when ANTHROPIC_API_KEY isn't
 * set, same convention as the other Claude routes. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let threadId: string;
  let messageBody: string;
  try {
    const body = await request.json();
    threadId = String(body?.threadId ?? "");
    messageBody = String(body?.message ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!threadId || !messageBody) {
    return NextResponse.json({ error: "Missing threadId or message" }, { status: 400 });
  }

  // getNolanThread relies on RLS (owns_nolan_thread) to return null for a
  // thread that doesn't exist *or* isn't the caller's — same 404-either-way
  // convention as getConversationDetail, so as not to leak thread ids.
  const thread = await getNolanThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  // Persist the user's turn immediately, before calling Claude, so it's
  // never lost even if the model call fails.
  const { error: insertUserError } = await supabase
    .from("nolan_messages")
    .insert({ thread_id: threadId, role: "user", body: messageBody });
  if (insertUserError) {
    return NextResponse.json({ error: insertUserError.message }, { status: 500 });
  }

  const client = getClaudeClient();
  if (!client) return NextResponse.json({ type: "fallback" });

  const [creator, history] = await Promise.all([
    getCreatorById(thread.creator_id),
    getNolanMessages(threadId),
  ]);

  // Lightweight peer grounding from the platform's own data — a handful of
  // other creators in the same primary category, ranked by ROI. Not a
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
        peerContextLine = `For rough context only: other ${primaryCategory.categories.name} creators on this platform average an ROI score around ${avgScore}/1000 and ${avgFollowers.toLocaleString()} followers (small in-platform sample, not an external market rate).`;
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
          ? `Their ROI score: ${creator.roi_scores.score}/1000 (grade ${creator.roi_scores.grade}, confidence ${creator.roi_scores.confidence != null ? Math.round(creator.roi_scores.confidence * 100) + "%" : "n/a"}).${topPositive ? ` Strongest factors: ${topPositive}.` : ""}${topNegative ? ` Weakest factors: ${topNegative}.` : ""}`
          : "ROI score: not yet computed (needs at least 30 days of metrics history).",
        primaryAccount
          ? `Primary platform: ${primaryAccount.platforms?.name}, @${primaryAccount.handle}, ${latestMetrics?.followers ?? "unknown"} followers.`
          : null,
        peerContextLine,
        pricingContextLine,
      ]
        .filter(Boolean)
        .join("\n")
    : "No creator profile context is available for this conversation.";

  const priorMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.body,
  }));

  let claudeStream: ReturnType<typeof client.messages.stream>;
  try {
    claudeStream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // Two stable blocks, cache breakpoint on the second — both are fixed
      // text with no per-request/per-user content, so the ~19K-token
      // combined prefix (persona + knowledge base) is read from cache on
      // every message in a thread rather than re-billed in full. Creator
      // context (volatile) stays in the user turn below, after this
      // breakpoint — see AGENTS.md on why order matters here.
      system: [
        { type: "text", text: NOLAN_SYSTEM_PROMPT },
        { type: "text", text: SPONSORSHIP_INDUSTRY_KNOWLEDGE, cache_control: { type: "ephemeral" } },
      ],
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages: [
        ...priorMessages,
        { role: "user", content: `${creatorContextLines}\n\n${messageBody}` },
      ],
    });
  } catch (err) {
    console.error("nolan/chat failed to start:", err);
    return NextResponse.json({ error: "Failed to reach Nolan." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const responseBody = new ReadableStream<Uint8Array>({
    start(controller) {
      let settled = false;

      claudeStream.on("text", (delta: string) => {
        controller.enqueue(encoder.encode(delta));
      });

      claudeStream.on("error", (err: Error) => {
        console.error("nolan/chat stream error:", err);
        if (settled) return;
        settled = true;
        controller.enqueue(
          encoder.encode("\n\n_Nolan's response was interrupted — please try again._"),
        );
        controller.close();
      });

      claudeStream.on("end", () => {
        if (settled) return;
        settled = true;
        void (async () => {
          try {
            const finalText = await claudeStream.finalText();
            if (finalText) {
              await supabase
                .from("nolan_messages")
                .insert({ thread_id: threadId, role: "assistant", body: finalText });
              await supabase
                .from("nolan_threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
            }
          } catch (err) {
            console.error("nolan/chat failed to persist assistant message:", err);
          } finally {
            controller.close();
          }
        })();
      });
    },
    cancel() {
      claudeStream.abort();
    },
  });

  return new Response(responseBody, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Nolan-Response": "stream",
    },
  });
}
