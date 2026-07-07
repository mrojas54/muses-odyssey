# Future Work — Per-User Auth via a FastAPI Token Broker

> **Status: DEFERRED / design note, not scheduled.** Captured 2026-07-06 while the
> Supabase quiz-history sync stalled on auth friction. The app currently has **no
> sync and no server** — progress lives in `localStorage` and (optionally) is
> seeded into the bundle. This doc preserves the server-mediated design so it can
> be picked up later without re-deriving it.

## Why this exists

The quiz-history sync design (`2026-07-06-quiz-history-sync.md`) chose a
**serverless** model: a single shared `muse_reader` JWT, minted once offline and
embedded in the static bundle. That works and needs no infrastructure, but it has
two intrinsic weaknesses:

1. **One shared, long-lived, bundle-visible token.** Anyone who views source can
   extract it and read/write *everyone's* quiz data. Accepted only because the
   data is non-sensitive (owner's explicit call, 2026-07-06).
2. **No per-user identity.** Every reader is the same `muse_reader`. There is no
   "my history vs. yours" — the schema deliberately has no per-user rows.

If the app ever grows the features its own schema comments already anticipate —
*"discussion threads, member notes, per-chapter responses"* — those need real
per-user auth, and the shared-token model can't provide it. This is the design for
that day.

## What blocked the simpler alternatives (session findings, 2026-07-06)

These were checked against live Supabase docs, not memory — record them so the
next agent doesn't re-walk the dead ends:

- **New API keys can't carry a custom role to the browser.**
  - `sb_publishable_...` is hard-locked to the `anon` role (or `authenticated`
    after a real Supabase Auth login). It can never run as `muse_reader`.
  - `sb_secret_...` is **physically fenced out of browsers** — it matches on the
    `User-Agent` header and returns `401`, and the docs forbid bundling it. So it
    cannot be the client credential for a static app regardless of its role.
  - ⇒ The **only** way to get a custom `role` claim into a browser client is a
    **self-signed JWT**, which requires holding a *symmetric* signing secret.
- **Asymmetric signing-key migration is dashboard-only** (Project Settings → JWT
  Keys → *Migrate JWT secret* → *Rotate keys*); there is no CLI command. Managed
  private keys **cannot be extracted**, so after a full migration you can only
  self-sign if you *import your own* shared secret / private key. The legacy HS256
  secret remains valid for verification and **cannot be permanently deleted**
  (rollback safety), so the serverless self-mint path stays open indefinitely.
- **Supabase MCP OAuth** kept returning `401 Unrecognized client_id` — a stale
  Dynamic Client Registration cached in the macOS login Keychain (one of ~470
  hashed `Claude Code-credentials-*` entries, not selectively evictable). Schema
  was deployed manually via the SQL editor instead. Not relevant to this design
  except as a reason MCP wasn't used.

## The design: a token broker

Introduce a minimal backend whose *only* job is to authenticate a user and mint a
short-lived JWT. The secret never leaves the server; the browser never signs.

```
browser ──(login: email link / OAuth / passkey)──▶ FastAPI broker
                                                      │  holds SUPABASE_JWT_SECRET
                                                      │  verifies the user
                                                      │  mints a SHORT-lived JWT:
                                                      │    { role: "muse_reader" | "authenticated",
                                                      │      sub: <user_id>, exp: now+15m }
browser ◀──────────(signed JWT, ~15 min)─────────────┘
   │
   └──(JWT in Authorization: Bearer)──▶ Supabase PostgREST ──▶ runs as that role,
                                                                RLS scopes rows by sub
```

The broker **is** the offline `mint-muse-token.py` script, promoted to a
per-request endpoint: same HMAC-sign operation, but fresh + short-lived + scoped
to a real user instead of one shared 90-day token.

### Endpoints (sketch)

| Method | Path | Does |
|--------|------|------|
| `POST` | `/auth/login` | start login (magic link / OAuth / passkey); out of scope which |
| `POST` | `/auth/token` | exchange a verified session for a fresh short-lived Supabase JWT |
| `POST` | `/auth/refresh` | reissue before `exp` (silent refresh) |

### JWT claims

```json
{ "role": "authenticated", "sub": "<stable user id>",
  "iss": "supabase", "ref": "agtfetvhsflmhhmddzxm",
  "iat": 0, "exp": 0 }
```

- Signed **HS256** with `SUPABASE_JWT_SECRET` (or an *imported* shared secret if the
  project has migrated to asymmetric keys — see blockers above).
- Short `exp` (~15 min) makes leakage low-impact and removes the 90-day manual
  rotation chore entirely.
- `sub` is the anchor for **per-user RLS**.

### Schema changes required

The current tables have **no per-user column** — every row is the shared reader's.
Per-user auth needs a `user_id` (matching `sub`) on each table and RLS rewritten
from `using(true)` to ownership predicates:

```sql
alter table public.book_progress    add column user_id uuid;
alter table public.attempts_summary add column user_id uuid;
alter table public.attempts_raw     add column user_id uuid;

-- replace the shared muse_rw policies with per-user ones, e.g.:
create policy own_rows on public.book_progress
  for all to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );
```

Supabase RLS gotchas that MUST be honored (from the supabase skill checklist):
- **UPDATE needs both `USING` and `WITH CHECK`**, or a user can reassign `user_id`.
- **UPDATE also needs a SELECT-able row** — `for all` covers it; split policies must add SELECT.
- **Never** authorize off `user_metadata` (user-editable); use `app_metadata` / `sub`.
- `TO authenticated` alone is auth-without-authorization (IDOR) — always pair with the ownership predicate.

### Client changes

- On load, hit `/auth/token`; hold the short JWT in memory (not `localStorage`).
- Feed it into the existing `window.LOOM_SYNC` → `CFG.token` seam — the sync layer
  already reads its token from one place, so this is a drop-in swap for the baked
  token.
- Silent refresh before `exp`; on 401, re-login.

## Where a server can live without betraying the "no build step" ethos

The app's identity is *"no server, double-click index.html."* A broker breaks that
for the *sync* path only (offline reading still needs nothing). Lightest options:

- **Supabase Edge Function** (Deno) — a broker "server" with zero separate infra;
  closest to the existing stack. Preferred if staying in Supabase.
- **FastAPI on a small host** (Fly/Render/Railway) — what the owner sketched;
  most control, most ops.
- **Cloudflare Worker** — cheapest edge option; HMAC-signs fine.

Whichever: the static reading app keeps working `file://`-offline; only cross-device
*history* requires the broker to be reachable.

## Decision to revisit before building

1. Is per-user history actually wanted, or is shared-reader still fine? (Today: shared is fine.)
2. If yes, pick the login method (magic link vs OAuth vs passkey) — drives broker complexity.
3. Pick the broker host (Edge Function recommended to preserve the low-ops ethos).
4. Only then: schema `user_id` migration + RLS rewrite + client token swap.

Until those are answered, this stays deferred. The serverless embedded-token path
(`mint-muse-token.py` + `supabase/schema.sql`, already deployed) remains the
shipping design.
