import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-opus-5";

/** Null when ANTHROPIC_API_KEY isn't set — every route checks this and
 * returns a `{type: "fallback"}` response instead of throwing, matching the
 * app-wide graceful-degradation pattern. */
export function getClaudeClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

/** Stable, cacheable platform description shared by every Claude-backed
 * route. Deliberately free of timestamps, user ids, or other per-request
 * content — those go in the *user* turn instead — so the prompt-cache
 * breakpoint on this block actually hits. See the claude-api skill's
 * prompt-caching guidance. */
export const PLATFORM_SYSTEM_PROMPT = `You are the AI assistant embedded in CreatorNetwork, a professional network that connects content creators with sponsors and brands.

The platform consolidates each creator's metrics (followers, views, engagement, upload cadence, growth trajectory) across YouTube, Instagram, and TikTok into a single profile, and computes a transparent 0-1000 ROI score from six weighted components: reach, engagement quality, consistency, trajectory, tenure, and audience authenticity.

Sponsors use the platform to discover creators, message them, and generate sponsorship paperwork. Creators can claim their auto-generated profile to edit it and control who can contact them.

Be concise, concrete, and professional. Never fabricate metrics, creator quotes, or facts not present in the context you're given.`;
