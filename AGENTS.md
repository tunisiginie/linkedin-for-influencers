<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions

**Read `HANDOFF.md` first** for what this app is, what's built, and what's unverified.

## The UI library is Base UI, not Radix

`components.json` points at shadcn, but the generated primitives in `src/components/ui/` wrap **`@base-ui/react`**. Radix habits from training data will not compile here:

| Radix habit | Base UI equivalent |
|---|---|
| `<Button asChild><Link/></Button>` | **`<LinkButton href="...">`** (`src/components/ui/button.tsx`) |
| `asChild` on any other primitive | the **`render`** prop: `<DropdownMenuTrigger render={<Button/>} />` |
| `<TooltipProvider delayDuration={n}>` | `delay={n}` |
| `<Select>` shows the raw value | pass **`items={[{value,label}]}`** to `<Select>` or `<SelectValue>` renders the raw stored string |
| `onValueChange={(v: string) => …}` | signature is `(value: string \| null, eventDetails) => void` |

Base UI's `Button` expects `render` to resolve to a real `<button>` (`nativeButton` defaults true) and its own docs say anchors should not go through it — that's why `LinkButton` applies `buttonVariants` to `next/link` directly instead.

## lucide-react v1 dropped every brand icon

`Youtube`, `Instagram`, `Twitter`, `Twitch` etc. no longer exist. Platform icons are generic stand-ins seeded in `schema.sql` (`Play`, `Camera`, `Music2`, `Radio`, `AtSign`) and resolved through `src/lib/icon-map.tsx`.

Render icon-name strings with **`<ResolvedIcon iconName={…} />`**, never `const Icon = resolveIcon(x)` followed by `<Icon/>` — assigning a component inside a render body trips `react-hooks/static-components`. `ResolvedIcon` is the single place that carries the (justified) lint disable. The prop is `iconName`, not `name`, because `SVGProps` already declares a non-nullable `name`.

## Graceful degradation is a hard requirement

Every integration must no-op when its env var is absent, so the app runs with zero secrets. Follow the existing guards — `isSupabaseConfigured()` in `src/lib/supabase/client.ts`, `getClaudeClient()` returning `null` in `src/lib/claude.ts`, and the `{ type: "fallback" }` responses in `src/app/api/**/route.ts`. Never introduce a code path that throws on a missing key.

## Claude usage

Model is `claude-opus-5` (`CLAUDE_MODEL` in `src/lib/claude.ts`). Use `output_config.format` for structured extraction — **assistant prefills return 400 on this model**. Keep `PLATFORM_SYSTEM_PROMPT` free of timestamps and per-user ids: it carries the `cache_control` breakpoint, and any volatile byte in it silently kills the prompt cache.

## Compliance rules are load-bearing, not decoration

- Only business emails the creator published themselves (`creator_contacts.source`). **No personal phone scraping or enrichment purchase** — the `phone` column exists but is only ever populated by the creator at claim time.
- `sendMessage` (`src/lib/actions/messages.ts`) checks `isCreatorContactable()` before a sponsor's *first* message in a thread. Don't bypass it.
- Official APIs only. No headless scraping of Instagram/TikTok — that's why `src/lib/ingest/seeded.ts` exists.

## Before finishing any change

`npm run build` (typecheck runs inside it) and `npx eslint .` must both be clean. `npm test` covers the ROI algorithm.
