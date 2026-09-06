import { LinkButton } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  BadgeCheck,
  Gauge,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const LIVE_PILLARS = [
  {
    icon: TrendingUp,
    name: "Scale",
    weight: "8%",
    description:
      "Audience size, how efficiently it converts to reach, growth trajectory, and how spread out a creator is across platforms.",
  },
  {
    icon: Activity,
    name: "Attention",
    weight: "26%",
    description:
      "Engagement rate, watch time (where available), and posting cadence — how much of the audience actually shows up, not just how big it is.",
  },
  {
    icon: ShieldCheck,
    name: "Trust",
    weight: "26%",
    description:
      "Audience authenticity — engagement and follower patterns that look organic rather than bought or bot-inflated.",
  },
  {
    icon: Radar,
    name: "Relevance",
    weight: "12%",
    description:
      "Topical authority in the creator's stated category, scored by Claude against a fixed 0–100 rubric — not a follower-count proxy.",
  },
  {
    icon: BadgeCheck,
    name: "Governance",
    weight: "2%",
    description: "How long the profile has been active and verified on the platform.",
  },
];

const NOT_YET_LIVE = [
  {
    name: "Commercial performance",
    description:
      "Actual campaign outcomes — click-through, conversion, sales lift. Requires connected campaign-tracking data no creator has linked yet.",
  },
  {
    name: "Deal economics",
    description:
      "Rate consistency and negotiation history across past sponsorships. Requires creator-declared pricing history, which the platform doesn't collect yet.",
  },
];

export default function JaeScorePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" /> How scoring works
      </span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        What&apos;s the <span className="text-primary">JAE Score</span>?
      </h1>
      <p className="mt-3 max-w-xl text-balance text-muted-foreground sm:text-lg">
        Think of it like a credit score, but for sponsorship ROI: one transparent number,
        0–1000, built from a creator&apos;s real platform metrics — not a follower count, and
        not a vibe.
      </p>

      <div className="mt-8 space-y-3 text-sm">
        <Bullet>
          <strong className="text-foreground">0–1000, graded A through F.</strong> Higher is
          always better, same direction as a FICO score.
        </Bullet>
        <Bullet>
          <strong className="text-foreground">Benchmarked against peers, not the whole platform.</strong>{" "}
          A creator is compared to others in the same category and roughly the same audience
          size — a 50K-follower cooking channel isn&apos;t judged against a 5M-follower one.
        </Bullet>
        <Bullet>
          <strong className="text-foreground">Only what has real data counts.</strong> Each
          pillar below is included only when there&apos;s an actual data source behind it. A
          pillar without data isn&apos;t guessed at — it&apos;s dropped, and the remaining
          pillars are reweighted to fill the gap.
        </Bullet>
        <Bullet>
          <strong className="text-foreground">Every score carries a confidence figure.</strong>{" "}
          A newer profile with less history, fewer connected pillars, or unusual patterns gets a
          lower confidence alongside its score — the score is never presented as more certain
          than the underlying data supports.
        </Bullet>
      </div>

      <h2 className="mt-12 text-xl font-semibold">The five live pillars</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Weights shown are each pillar&apos;s share of the score when all five are present.
      </p>
      <div className="mt-4 space-y-3">
        {LIVE_PILLARS.map((p) => (
          <Card key={p.name}>
            <CardContent className="flex items-start gap-3 px-4 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-lg) bg-primary/10 text-primary">
                <p.icon className="size-4.5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.weight}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{p.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold">What it doesn&apos;t measure yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Two more pillars are designed into the score but not switched on, because the data
        they need doesn&apos;t exist on the platform yet. We&apos;d rather say that plainly than
        fake it with a proxy.
      </p>
      <div className="mt-4 space-y-3">
        {NOT_YET_LIVE.map((p) => (
          <Card key={p.name} className="border-dashed">
            <CardContent className="px-4 py-3.5">
              <span className="font-semibold text-muted-foreground">{p.name}</span>
              <p className="mt-0.5 text-sm text-muted-foreground">{p.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-10">
        <CardContent className="flex items-start gap-3 px-5 py-4">
          <Gauge className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            The score is recomputed regularly as new metrics come in, and every creator can see
            their own full pillar breakdown — including what&apos;s helping and what&apos;s
            holding them back — from their profile.
          </p>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/search?sort=roi" size="lg">
          See top-scoring creators
        </LinkButton>
        <LinkButton href="/claim" variant="outline" size="lg">
          Find your own score
        </LinkButton>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

export const metadata = {
  title: "What's the JAE Score? — CreatorNetwork",
};

// Reminder for anyone touching this page: it links from the footer, the
// creator-profile badge area, and the landing hero (see src/app/page.tsx,
// src/components/site-footer.tsx, and the creator profile page). Keep the
// pillar list here in sync with PILLAR_BASELINE_WEIGHTS and which pillars
// actually combine real variables in src/lib/roi/score.ts — this page
// should describe what's true today, not the aspirational roadmap.
