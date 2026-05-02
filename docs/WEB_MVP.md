# Web MVP

The current primary product surface is `apps/webapp`.

## Decision

Vicina is now web-first. The Next.js App Router scaffold presents the smallest
stable hyperlocal coordination loop:

- Browse active signals by selected area at `/nearby`.
- Filter by area, distance, category, and time.
- Sort explicitly by nearest, soonest, or newest.
- Create a short-lived signal at `/create`.
- View signal detail, interest, thread, report, and block actions at `/signal/[id]`.
- See a simple local profile at `/profile`.

The web app uses browser-local mock signal data in
`apps/webapp/src/lib/mock/signals.ts`. This keeps the interface testable before
the web surface is wired to Supabase. The older local API route handlers remain
available for reference while the signal model settles.

## Brand

The root logo inspiration image has been archived at
`assets/branding/vicina-logo-reference.jpg`. The shipped web UI uses a clean SVG
brand mark based on the useful parts of that reference: map pin, nearby people,
muted green, neutral surfaces, and generous spacing.

## Constraints

- No likes.
- No follower counts.
- No algorithmic popularity ranking.
- No public exact coordinates.
- No implicit live-location lookup before an explicit permission flow exists.
- No infinite-scroll engagement loop.

## Run

```bash
pnpm dev:web
```

## Verify

```bash
pnpm verify:web
pnpm doctor
```

## Next Backend Cut

Supabase is the intended backend foundation. When the web interaction model is
stable, replace the browser-local mock store with a Supabase-backed adapter using
the existing `supabase/migrations/20260502120000_vicina_mvp.sql` schema.
