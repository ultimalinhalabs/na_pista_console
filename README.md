# Na Pista Console (Default UI)

The Na Pista **Default UI** (F18 ADR-008) — a consumer of the [Na Pista API](../na-pista), never a source of
authorization. Its own repository, on purpose: a Custom UI built by Última Linha for a specific client (or by
the client itself) consumes the exact same API this app does, with no code shared and no fork of the core.

## Architecture

```
Browser
  │  Supabase Auth (client-side, @supabase/supabase-js)
  ▼
na-pista-console (this app)
  │  Authorization: Bearer <access_token>, HTTPS
  ├──────────────► Na Pista API (/v1/organizations/:id/products, /categories)
  └──────────────► UL Platform API (/v1/me — which organizations do I belong to)
```

- Never talks to any database directly.
- Never holds a Supabase service-role key — only `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  both meant to be public.
- Never decides authorization. `lib/permissions.ts` is a **UX-only** mirror of Na Pista's real, server-side
  permission map — hiding a button here is convenience, not a security boundary; the real gate is Na Pista's
  own API (proven independently by its own E2E test suite).
- `/o/[organizationId]/layout.tsx` cross-checks the URL's `organizationId` against the caller's real Platform
  memberships (`GET /v1/me`) before rendering anything under it — the same `OrganizationGate` posture
  `ul-client` already established.
- Client-rendered only in this pass (no SSR session-refresh middleware like `ul-client`'s `proxy.ts`) — a
  documented simplification, not a security shortcut (see `na-pista/docs/f20-report.md` "Known limitations").

## Running

```bash
npm install
cp .env.example .env.local   # Supabase URL/anon key + the Na Pista/Platform API URLs
npm run dev                  # :3010
npm run build && npm run lint && npm run typecheck
```

Requires a running Na Pista API (`../na-pista`, `npm run dev`) and UL Platform (`../ul-platform`, `npm run dev`).
