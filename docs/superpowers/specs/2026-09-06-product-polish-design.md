# Clean · Polished · Usable: Product Polish Design

**Date:** 2026-09-06
**Question asked:** the project grew out of experiments — how do we clean and refactor it into a clean, polished, usable version?
**Answer:** the code structure was already rebuilt in July (see `2026-07-27-rebuild-assessment.md`, steps 1–3 done). What remains is the demo → product gap. Approved plan: **in-place hardening**, four ordered phases — D (cut scope) → C (session continuity) → B (flow polish) → A (visual atmosphere, separate brief later).

---

## Decisions (all approved by the owner)

| # | Decision | Ruling |
|---|----------|--------|
| 1 | Target usage | **Private tabletop**: host runs the server on the game machine (double-click), friends join over LAN/tunnel. Players are trusted. |
| 2 | Deployment shape | Local double-click launch (`start.bat`); no daemon, no Docker. Persistence must be crash-safe; no auto-resume of *sockets* needed beyond reload. |
| 3 | Public lobby | **Cut.** Replaced by a campaign book (saved-games list) + invite links + join-by-code. |
| 4 | Private chat (whisper) | **Keep.** |
| 5 | Emotes | **Cut.** |
| 6 | Settings modal | **Downgrade to read-only + connection test.** `.env` is the single source of truth; changing config means editing `.env` and restarting. Removes an unauthenticated LAN write endpoint. |
| 7 | Rejoin tokens after restart | **Persist** token→seat map to `saved_games/.sessions.json`. Threat model: LAN private play — this file's secrecy class equals `.env`, already on the same disk. |
| 8 | Visual atmosphere (A) | Last phase, own mini-brief; not locked here. |

## Why these are right for this scenario

- The runtime config editor never actually hot-reloaded running games (`restartRequired: true` — engines build their LLM client at creation). It only edited `.env` from the browser, while exposing `POST /api/config` to every LAN device with no auth. Cutting it closes a real hole and deletes the mask/restore round-trip machinery.
- Rejoin tokens in memory only meant: server restart → everyone is a stranger → duplicate characters in the roster. The original "never persist credentials" trade-off was written for a public deployment; it no longer matches the private-LAN threat model.
- The active-games lobby goes empty on every restart and leaks game names to strangers. The saved-games list *is* the truth for a private campaign table.

---

## Phase D — Cut scope

### D1. Kill the live lobby, open the campaign book
- Delete `GET /api/games`, the `LIST_GAMES` WS handler, `LobbyView.renderActiveGames`, `App.fetchActiveGames` and its 30 s polling.
- Home screen becomes three things: **New campaign** / **Join by code** (invite link `?game=ID` remains the primary path; a text field accepts a pasted code) / **Continue** — the saved-games list (`GET /api/saved-games`, already exists) sorted by `lastPlayedAt`, showing name, scenario, player count, last played.

### D2. Cut emotes
- Delete `shared/schemas/emote.ts` and its export, the `PLAYER_EMOTE` handler branch in `websocket/handlers/chat.ts`, the emote selector in `action-bar.ts`, the `EMOTE_MESSAGE` handling in `app.ts`/`views/chat.ts`, emote keys in all 5 locale files (parity test enforces completeness), and their tests.

### D3. Settings modal → read-only + test
- Keep `GET /api/config` (masked key display) and the connection test; delete `POST /api/config` and `GET /api/config/models`.
- The test endpoint switches to testing the **stored** config with an empty-body POST — the mask/restore dance (`resolveApiKey`) loses its reason to exist.
- Modal shows provider / endpoint / model / masked key + **Test connection**; add a line stating config lives in `.env` and applies after restart.

### D4. Repository hygiene
- Delete merged local branches `feat/i18n-support`, `phase3-implementation`; delete zombie remote `origin/master`.
- (Logger migration happens in Phase B, same theme as error handling.)

## Phase C — Session continuity

### C1. Atomic saves
`storage.saveGame` writes `${id}.json.tmp` then `rename`s over the target (Node replaces atomically on Windows). The chat-history merge logic is untouched. A crash mid-write can no longer corrupt a campaign file.

### C2. Tokens survive restarts
`playerSessions` persists its token→seat map to `saved_games/.sessions.json` (side file; never part of game state, never broadcast). Loaded at startup; entries released when a seat is abandoned for good or the game is deleted. Refresh-after-restart reclaims the original character. Update the trade-off comment in `sessions.ts` and the architecture note in AGENTS.md.

### C3. Save after every narrative
Each completed AI narration (opening scene + player-action replies) triggers a debounced save (~5 s); the 60 s dirty-check timer stays as backstop. Worst-case story loss drops from one minute to one action.

### C4. `lastPlayedAt`
New field on `Game`; refreshed on save and on player join; drives campaign-book sorting. Old saves without it fall back to `createdAt`.

### C5. Dead-code investigation
`GameStore.snapshots` (in-memory Map written every 5 min) appears to have no readers — confirm and delete if dead.

## Phase B — Flow polish

### B1. Cancel a running narration
New `CANCEL_STREAM` WS message → `AbortSignal` threaded through `LLMInteractionService` into both provider clients (fetch + Anthropic SDK both support signals). Narration already streamed is kept as the narrative; rate-limited like other LLM-triggering messages.

### B2. Failures stop pretending to be stories
Delete the server-side fallback text (`"You attempt… The result is uncertain…"`) that was persisted into history as fake narrative. `STREAM_ERROR` instead renders an explicit **error card** in the log (transient, like a dice roll — not saved) with a **Retry** button; the client re-sends the last action payload.

### B3. Idle timeout
If a stream emits no chunk for `LLM_IDLE_TIMEOUT_MS` (default 45 s), abort it and route to the error card. A stalled remote API can no longer spin forever.

### B4. Reconnection banner
A persistent header banner ("connection lost — reconnecting…") replaces the fire-and-forget toast; auto-dismisses with a success note when the socket returns.

### B5. Unified logging
`src/utils/logger.ts` with levels gated by `LOG_LEVEL`; replace all ~59 bare `console.*` in `src/`. Mechanical, separate commit.

## Phase A — Visual atmosphere (direction only)

After B/C ship: dice-roll presentation, DM "composing" presence animation, inline SVG icon set replacing emoji, parchment texture layer. Own mini-brief with options for the owner to pick; explicitly not designed here.

## Testing

- **E2E additions:** resume-after-restart (kill + relaunch server mid-game), cancel-stream, failure → retry card, campaign-book listing.
- **Unit:** atomic write (tmp+rename, no leftover tmp), sessions persistence round-trip, `lastPlayedAt` update/fallback, locale parity after emote removal.
- The existing 384 unit tests + smoke suite stay green throughout; tests of cut features are cremated with them.

## Out of scope

Authentication beyond invite links and seat tokens · databases · Docker/deployment tooling · hot-reload of LLM config · internet-facing hardening · emotes · public lobbies of any kind.
