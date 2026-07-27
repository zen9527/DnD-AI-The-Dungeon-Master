# Full Rebuild: Assessment and Plan

**Date:** 2026-07-27
**Question asked:** the project has a long history and a lot of redundant/duplicated code — can it be fully rebuilt against the original requirements?
**Answer:** I recommend **no** — but the reasoning matters more than the verdict, and a scoped rebuild plan is included in case you disagree.

---

## 1. What the codebase actually looks like now

Measured, not estimated:

| | |
|---|---|
| Source | 67 TypeScript files, ~9,030 lines |
| Largest file | 509 lines (`llm-interaction.ts`) |
| Tests | 29 files, 384 tests |
| Type safety | backend + frontend both clean |
| CI | typecheck + tests + build on every push |

The instinct that this is a long-lived, crufty codebase was **true two weeks ago**. At that point it had three god objects (1564, 1508, 1331 lines), no frontend type-checking at all, and 26 latent bugs — several of which meant whole features silently did nothing. That codebase would have been a reasonable rewrite candidate.

The work since then has already done most of what a rewrite would buy:

- `WebSocketManager` 1564 → 171 lines, split into a handler registry
- `GameEngine` 1331 → ~300 lines, split into four composed services
- `app.ts` 1508 → 503 lines, split into seven view modules
- `character.ts` 648 → 475, with pure logic extracted and unit-tested
- Frontend brought under `tsc` (it never had been), which surfaced four live bugs on the first run

**A rewrite now would mostly re-derive the structure that already exists.**

## 2. What redundancy genuinely remains

This is the honest list, all of it measured:

| Item | Evidence | Size |
|---|---|---|
| Screen scaffolding repeated in `character.ts` | `renderLocaleDropdownHTML` appears 5×, the `locale-select` change handler 8× | ~60 lines |
| `showRaceDescription` / `showClassDescription` | near-identical twins differing only in the key prefix | ~45 lines |
| `GET /api/games/:id/load` | no client calls it; `LOAD_GAME` over WebSocket replaced it | 1 route |
| `Game.events: Event[]` | never written and never read, anywhere — but carried in every save file and every broadcast | 1 field |
| `parchment-preview.html`, `pixel-preview.html` | dead theme mockups, still shipped in `public/` | 39 KB |
| Unused CSS | 6 genuinely unreferenced classes out of 162 | negligible |

Total: roughly **150 lines of duplication, one dead route, one dead field, and 39 KB of dead HTML.**

That is a half-day cleanup, not a rewrite. Notably, the CSS — the thing that *looks* most legacy at 2,048 lines — is 96% live.

## 3. Why I recommend against the rewrite

**The value is already banked.** The structural problems that justify a rewrite — untestable god objects, no type safety, no test coverage — have been fixed incrementally, with each step verified against a running server.

**The risk is asymmetric.** The current code carries 384 tests' worth of encoded behaviour, and a lot of that behaviour is *hard-won*: the snapshot-invalidation discipline, the rejoin-token security property, the chat-history merge on save, the per-locale skill-check mapping, the streaming accumulation. Every one of those was a bug found by careful work. A rewrite starts from the *requirements*, which do not record any of them — so the most likely outcome is quietly reintroducing bugs that are currently fixed and tested.

**The remaining pain is not structural.** What still bothers you is, I suspect, two things a rewrite would not fix by itself:
1. The **visual design** — untouched by all of this, because it was out of scope.
2. The feeling that changes keep surfacing new bugs — including one I introduced myself today. That is a symptom of thin end-to-end coverage at the UI layer, which is cheaper to fix directly than by starting over.

**Today's bug is the argument in miniature.** "Create New Game stopped responding" was not legacy cruft — it was a rate limiter *I added yesterday*, set too close to honest use, with feedback that vanished in four seconds. New code produces new bugs. A rewrite is 9,000 lines of new code.

## 4. What I would do instead

Ordered by value. Roughly two days total.

### Step 1 — Delete what is dead (~2 hours)
- Remove `GET /api/games/:id/load` and its handler file.
- Remove `Game.events` from the type, the engine, and save files (with a migration that drops the key on load).
- Delete `parchment-preview.html` and `pixel-preview.html`.
- Remove the 6 unreferenced CSS classes.

### Step 2 — Collapse the duplication in `character.ts` (~3 hours)
- Extract a `screen(title, body)` helper that renders the locale dropdown, settings trigger, and their handlers once. Removes ~60 lines and 8 copies of one event wiring.
- Merge `showRaceDescription`/`showClassDescription` into `showChoiceDescription(kind, value)`.
- Target: `character.ts` under 300 lines.

### Step 3 — Close the UI coverage gap that keeps letting bugs through (~1 day)
This is the one that addresses "sometimes there are bugs" at the root.
- A Playwright (or equivalent) smoke suite driving the **real browser against the real server**: create a game, take a turn, roll dice, refresh and reclaim your seat, switch language, save and load. Six flows.
- Today's bug would have been caught by flow #1 the moment the limiter shipped. So would the streaming flicker, the empty DM panel, and the dead action bar.
- Wire it into CI.

### Step 4 — Then, separately, the visual design
Treat this as its own project with its own brief, not as part of a code cleanup. It needs direction from you (layout? palette? density? mobile?), not refactoring.

## 5. If you want the rewrite anyway

It is a legitimate call — sometimes you want to own the whole shape. Scoped honestly:

**Effort:** ~2–3 weeks to reach current functional parity, most of it re-deriving behaviour that is currently encoded only in tests and bug-fix commits.

**Mandatory precondition:** the browser smoke suite from Step 3, written **first**, against the *current* app. Without an executable definition of "working", a rewrite has no way to know when it has arrived, and the 29 bugs fixed so far will silently come back. This is non-negotiable in my view — and note it is also Step 3 above, which is why I would do it regardless.

**Phasing that keeps the app alive throughout:**
1. Write the smoke suite against today's app; it becomes the contract.
2. Keep `shared/` (schemas + the LLM envelope parser) — it is already the clean boundary and is provider-agnostic.
3. Rebuild the server: transport → game domain → LLM adapters. Run both old and new behind a flag; the suite must pass on both.
4. Rebuild the client, screen by screen, against the unchanged WebSocket protocol.
5. Delete the old code only once the suite is green on the new path for a full week of real play.

**What I would keep verbatim regardless:** `shared/schemas/*`, `parseLLMResponse`, the locale files, and the four hard-won invariants recorded in AGENTS.md (snapshot discipline, token placement, key masking, history merge).

---

## Recommendation

Do steps 1–3 (about two days) rather than a rewrite. If the app still feels wrong after that, the problem is the visual design, and that is worth attacking directly with a brief rather than obliquely through a rewrite.

I will do either — this is a judgement call and it is yours to make. But you asked whether it *can* be fully rebuilt, and the honest answer is: it can, it just would not buy you much that the last two weeks did not already deliver, and it would put 29 fixed bugs back at risk.
