# The Muse's Odyssey — reading companion for the Iliad & Odyssey

> Single source of truth for all agents/tools. `CLAUDE.md` is a symlink to this
> file, so Claude Code, Codex, Cursor, etc. all read the same guidance.

A data-driven static app. (Internal codename in the source: `LOOM_*` — the data
registry and localStorage keys keep that prefix; the *product* name is The Muse's
Odyssey.) One renderer (`app/index.html`), one data file per book
(`data/<id>.js`), one manifest (`data/manifest.js`). No build step or server is
needed to *read* it — double-click `app/index.html`. (A bundler produces the
deployed single file; see **Build & deploy**.)

## How it works
- Data files are **`.js`, not `.json`**, on purpose: browsers block `fetch()` on
  `file://`, but `<script>` tags load fine. Each data file registers itself into
  `window.LOOM_DATA`. The manifest lists which ids to load.
- The renderer reads a book object and draws: scene-set → words-to-carry →
  movements (what happened / why it matters) → similes & panels → character roster →
  the Ninth Hour examination. Quiz scores persist in `localStorage` per book.

## The data contract
See `schema.md`. To add a book: write `data/<id>.js`, append the id to
`window.LOOM_BOOKS` in `data/manifest.js`. Nothing else.

## Build & deploy
`app/index.html` + `data/*.js` are the source of truth; read them locally by
double-clicking `app/index.html` (no build needed). Two derived, self-contained
single files come from the bundler:

    node build-single-file.js          # inline manifest + all books, iOS/file:// hardened
    cp the-muses-odyssey.html index.html

- `the-muses-odyssey.html` — offline / phone / AirDrop copy (git-ignored; regenerate anytime).
- `index.html` (repo root, **committed**) — the byte-identical deploy copy GitHub
  Pages serves at https://mrojas54.github.io/muses-odyssey/.

`main` is the trunk: it carries the source tree **and** the built `index.html`, so
the branch you edit is the branch you deploy. Deploy = rebuild → copy to
`index.html` → commit → push `main` (Pages redeploys on push). Re-run the bundler
after authoring a book (once its id is in `data/manifest.js`) so the deployed
bundle matches the source.

## Voice — the Loom / the Oracle
- Parchment register, lightly mythic, never purple. Georgia serif, wine + gold.
- The three Fates frame the reading: Clotho sets the measure, Lachesis allots the
  pages, Atropos waits at the theater door (the July 28 book-club deadline).
- The nightly quiz is "the Ninth Hour" / "the Oracle's Examination"; results are
  "the Fates' verdict." Keep that diction.
- **Spoiler-aware, not spoiler-blind:** the reader has already read the earlier
  books, so it's good to name what a book *sets up* (e.g. Book 1's nod → Book 2's
  Dream). Do not foreshadow books not yet read unless flagged.
- Honesty over flourish: if a Greek term or claim is uncertain, say so plainly.
  (E.g. *Iliad* names Troy/Ilios; it does not mean "wound.")

## Source text & quotation
- The reader's translation is **Robert Fagles** (Penguin Classics; Bernard Knox
  introductions). Match Fagles' name spellings and phrasing; when a movement leans on
  a memorable line, prefer Fagles' wording.
- **Epigraphs and any quotation marks must be verbatim Fagles** — cite book.line
  (e.g. *Fagles, Iliad 1.1–2*). If a line cannot be confirmed verbatim, do NOT wrap it
  in quotation marks: paraphrase in the app's own voice, or label it "after Fagles".
  Never present a paraphrase as a quote.
- Resonance worth keeping: Fagles' *Odyssey* opens "Sing to me of the man, Muse…" —
  the source of the app's name.

## Authoring a deep dive
Use the `/deep-dive-odyssey` command (`.claude/commands/deep-dive-odyssey.md`) — the
app-specific authoring command: give it an epic and book number; it produces the
`data/<id>.js` file to schema and registers it.
Movements should follow the book's major beats — as many as it has, up to ~10, no
forced floor; quiz 4–6 omens; always include `why it matters` and at
least a couple of `terms`.

## Backend — Supabase cross-device sync

The quiz-history sync feature (see `docs/superpowers/plans/2026-07-06-quiz-history-sync.md`
and `supabase/schema.sql`) stores quiz history in Supabase. localStorage stays the
instant on-device source of truth; Supabase is best-effort, fire-and-forget.

### Row-Level Security (RLS) policy

This project auto-enables RLS on every table. `supabase/schema.sql` installs a
DDL event trigger (`on_create_table_force_rls`) that flips `ENABLE ROW LEVEL
SECURITY` on at `CREATE TABLE` time for any table in the `public` schema. This is
deliberate: SQL-created tables ship with RLS **off**, and an RLS-off table in an
exposed schema is reachable through the Supabase Data API by the `anon` role.

**The rule that follows: a new table is deny-all until you write it a policy.**
RLS-on with no policy blocks everyone — including the app. So whenever you add a
table:

1. **Assume it will exist but return nothing.** "Table exists but the app reads
   an empty array / a write silently fails" is the *expected* symptom of a table
   without a policy — not a bug. The fix is always **add the policy**, never
   "turn RLS off."
2. **Write a policy scoped to the `muse_reader` role**, matching the access that
   table actually needs — do not blindly copy the same grants onto every table.
   The established pattern (see `supabase/schema.sql`):

   ```sql
   -- grant the DB-level privileges the role needs on the new table
   grant select, insert on public.<new_table> to muse_reader;
   grant usage, select on all sequences in schema public to muse_reader;  -- if it has an identity/serial col

   -- then the RLS policy that opens exactly that access to muse_reader
   create policy muse_rw on public.<new_table>
     for all to muse_reader using (true) with check (true);
   ```

   Narrow `for all` / `using (true)` if the table needs read-only or per-row
   rules; `using(true)` is only correct because this is a single shared reader
   with no per-user rows.
3. **Never weaken RLS to "fix" access.** Do not `disable row level security`, do
   not grant to `anon`/`authenticated` to make a table readable. If a table must
   be reachable, it gets a `muse_reader` policy — nothing broader.
4. **UPDATE needs a SELECT policy too.** In Postgres RLS an UPDATE must first
   SELECT the row; without a matching SELECT policy an update returns 0 rows with
   no error. `for all` covers this; if you split policies by command, add SELECT.

**Verify after any schema change** (a fix without verification is incomplete):

```sql
-- every public table must have RLS on
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- the auto-RLS trigger must still be armed
select evtname, evtenabled from pg_event_trigger where evtname = 'on_create_table_force_rls';
```

Or run the Supabase security advisor (`supabase db advisors`, or MCP
`get_advisors` type `security`) before committing a migration — it flags any
`public` table still missing RLS or a policy.

## HTML Artifacts
When generating HTML study artifacts (book walkthroughs, character sheets, examinations), confirm the file was fully written and report the final path before ending the session.
