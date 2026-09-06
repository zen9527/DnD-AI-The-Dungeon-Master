# Product Polish (D→C→B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the experimental D&D DM app into a clean, usable private-table build: cut lobby/emotes/runtime-config-editing, make sessions survive restarts and crashes, and give LLM stalls/cancel/failure an honest UI.

**Architecture:** In-place hardening on `main`, three phases in order — D (cut scope) → C (session continuity) → B (flow polish). Spec: `docs/superpowers/specs/2026-09-06-product-polish-design.md`. All decisions already approved by the owner; do not re-litigate them.

**Tech Stack:** Node+TS (ESM, tsc→dist), Express+ws, Vite frontend (`public/js`, separate tsconfig), Zod shared schemas, vitest unit/integration, Playwright e2e against a stub LLM (`tests/e2e/stub-llm.mjs`).

**Global rules for every task:**
- After backend edits: `npx tsc --noEmit` must pass. After frontend edits: `npm run typecheck:frontend`. Full gate before pushing: `npm run typecheck && npx vitest run && npm run build`.
- Never run `npm start` (hangs). E2E only via `npx playwright test`.
- i18n: any locale key added/removed must be applied to **all 5** files in `locales/`; `tests/i18n/locale-parity.test.ts` enforces parity.
- New server-side logging uses the logger from Task 1, never bare `console.*`.

---

### Task 1: Logger (foundation for everything after)

**Files:**
- Create: `src/utils/logger.ts`
- Modify: every file in `src/` containing `console.log|console.warn|console.error` (~15 files)
- Modify: `.env.example`

- [ ] **Step 1: Write the logger**

```ts
// src/utils/logger.ts
export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function threshold(): number {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  return ORDER[raw as LogLevel] ?? ORDER.info;
}

function emit(level: LogLevel, args: unknown[]): void {
  if (ORDER[level] < threshold()) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  // warn/error keep their stream so they show up in stderr on crashes.
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(line, ...args);
}

export const log = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
```

- [ ] **Step 2: Replace every bare console call in `src/`**

Mapping: `console.log(` → `log.info(`, `console.warn(` → `log.warn(`, `console.error(` → `log.error(`. Add `import { log } from "<relpath>/utils/logger.js";` per file. Find them all with:
`grep -rn "console\.\(log\|warn\|error\)" src --include='*.ts'`
Do not change message text — only the call.

- [ ] **Step 3: Document the knob** in `.env.example`: `LOG_LEVEL=info` (debug|info|warn|error).

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npx vitest run` → all green; `grep -rn "console\." src --include='*.ts' | grep -v logger.ts` → empty.

- [ ] **Step 5: Commit** `chore: route all server logging through a leveled logger`

---

### Task 2 (D1): Cut emotes

**Files:**
- Delete: `shared/schemas/emote.ts`
- Modify: `shared/index.ts` (remove the two emote export lines, keep private-chat)
- Modify: `src/types/index.ts` (remove `'PLAYER_EMOTE'` and `'EMOTE_MESSAGE'` from MessageType; remove `"emote"` from ChatMessage type union)
- Modify: `src/websocket/handlers/chat.ts` (delete `handleEmote`, its registry entry, the `emoteSchema` import)
- Modify: `public/js/action-bar.ts` (delete the `/emote ` parse block, ~lines 191–196)
- Modify: `public/js/app.ts` (delete `wsManager.on("EMOTE_MESSAGE", ...)` line; `applyChatUpdate` stays for CHAT_MESSAGE)
- Modify: `public/js/views/chat.ts` (remove the emote render branch — grep `emote`)
- Modify: all 5 `locales/*.json` (delete every key starting `"emote.`, e.g. `emote.format`; edit `action.placeholder` value to drop `/emote text, `, keep the `/pm` hint)
- Modify: tests referencing emotes — `grep -rn "EMOTE\|emote" tests --include='*.ts'`, delete those cases (known: `tests/websocket/manager.test.ts`)

- [ ] **Step 1:** Delete server + shared code above. `npx tsc --noEmit` → the only errors left should be frontend ones.
- [ ] **Step 2:** Delete frontend usages. `npm run typecheck:frontend`.
- [ ] **Step 3:** Prune locale keys in all 5 files. `npx vitest run tests/i18n` → parity green.
- [ ] **Step 4:** `npx vitest run` → green (old saves containing `"type":"emote"` render as plain text by default branch — acceptable, they read fine).
- [ ] **Step 5: Commit** `feat!: drop emotes from the game loop`

---### Task 3 (D2): Kill the live lobby, ship the campaign book home

**Files:**
- Modify: `src/server.ts` (delete `app.get("/api/games", ...)` block)
- Modify: `src/websocket/handlers/game.ts` (delete `handleListGames` + registry entry; drop now-unused `gameStore.listGames` usage)
- Modify: `src/game/store.ts` (delete `listGames()` — grep first to confirm no other callers)
- Modify: `src/types/index.ts` (remove `'LIST_GAMES'`; grep `'GAME_STATE'` senders — if only handleListGames sent it, remove that type too)
- Modify: `public/js/app.ts` (delete `fetchActiveGames`, `ACTIVE_GAMES_REFRESH_MS`, the polling interval, and the CharacterCreator callback; `new CharacterCreator()`)
- Modify: `public/js/character.ts` (delete the `active-games-section` markup block ~lines 60–66 + its constructor callback param; add a **Join by code** card between the create form and the saved list)
- Modify: `public/js/views/lobby.ts` → keep only `showJoinForm`; rename class to `JoinView` (update imports in app.ts)
- Modify: all 5 locale files (remove `active_games.*` keys; add below)
- Modify: `tests/e2e/game.spec.ts` (replace flow 6 with the campaign-book + join-by-code flow below)

New i18n keys (all 5 locales; zh/ja/ko translations inlined):
```json
"home.join_code.title": "Join a campaign",
"home.join_code.placeholder": "Paste the game code from your invite link",
"home.join_code.btn": "Join",
"home.campaign_book.title": "Campaigns on this machine"
```
en shown; zh-CN: `"加入战役"` / `"粘贴邀请链接中的游戏口令"` / `"加入"` / `"本机存档"`; ja-JP: `"キャンペーンに参加"` / `"招待リンクのゲームコードを貼り付け"` / `"参加"` / `"このマシンのキャンペーン"`; es-ES: `"Únete a una campaña"` / `"Pega el código del enlace de invitación"` / `"Unirse"` / `"Campañas en esta máquina"`; ko-KR: `"캠페인 참가"` / `"초대 링크의 게임 코드를 붙여넣으세요"` / `"참가"` / `"이 머신의 캠페인"`.

Join-by-code markup inside the home screen (after the create form, before saved games), wired in `character.ts`:
```html
<div class="join-code-section">
  <h3>${t("home.join_code.title")}</h3>
  <div class="join-code-row">
    <input type="text" id="join-code-input" placeholder="${t("home.join_code.placeholder")}">
    <button type="button" class="primary" id="join-code-btn">${t("home.join_code.btn")}</button>
  </div>
</div>
```
```ts
document.getElementById("join-code-btn")?.addEventListener("click", () => {
  const code = (document.getElementById("join-code-input") as HTMLInputElement).value.trim();
  if (code) window.location.href = `?game=${encodeURIComponent(code)}`;
});
```

- [ ] **Step 1:** Server cuts above → `npx tsc --noEmit` passes except frontend.
- [ ] **Step 2:** Frontend rework + locales → `npm run typecheck:frontend`, `npx vitest run`.
- [ ] **Step 3:** Replace e2e flow 6:
```ts
test("flow 6 — the campaign book lists saved games and a code joins them", async ({ page }) => {
  const gameName = `Smoke: Book ${Date.now()}`;
  await createGame(page, gameName);
  await waitForOpeningScene(page);
  await page.click("#save-game-btn");
  const gameId = new URLSearchParams(page.url()).get("game")!;

  await page.goto("/");
  const card = page.locator("#saved-games-container .game-card", { hasText: gameName });
  await expect(card).toBeVisible();

  await page.fill("#join-code-input", gameId);
  await page.click("#join-code-btn");
  await expect(page.locator("#join-form")).toBeVisible();
});
```
- [ ] **Step 4:** `npx playwright test -g "flow 6"` → PASS. Full `npx vitest run` green.
- [ ] **Step 5: Commit** `feat!: replace the live lobby with a campaign-book home + join-by-code`

---

### Task 4 (D3): Settings modal → read-only + connection test

**Files:**
- Modify: `src/routes/config.ts` — keep `getConfigHandler`, `testAnthropic`, `testOpenAICompatible`; delete `postConfigHandler`, `getModelsHandler`, `listAnthropicModels`, `listOpenAICompatibleModels`, `resolveProvider`; rewrite the test handler to probe the **stored** config:
```ts
/** POST /api/config/test — probe the stored .env config. No body. */
export async function postConfigTestHandler(_req: Request, res: Response): Promise<void> {
  const config = configManager.read();
  const result = config.llmProvider === "anthropic"
    ? await testAnthropic(config.llmApiKey ?? "", config.llmModel)
    : await testOpenAICompatible(config.llmBaseUrl, config.llmApiKey ?? "", config.llmModel);
  res.json(result);
}
```
- Modify: `src/server.ts` — delete `app.post("/api/config", ...)` and `app.get("/api/config/models", ...)` + their imports.
- Modify: `src/utils/secrets.ts` — delete `isMaskedApiKey` and `resolveApiKey` (grep confirms only routes/config used them); keep `maskApiKey`; trim its doc comment to drop the resolveApiKey sentence.
- Delete: `shared/schemas/config.ts` **iff** grep shows no remaining consumers of `configSchema`/`endpointPresets`/`ANTHROPIC_MODELS`/`llmProviderSchema` after this task; remove its export block from `shared/index.ts`. (If `LLMProviderId` is imported from here anywhere frontend-side, keep just that type in a slim file.)
- Rewrite: `public/js/views/settings-modal.ts` (~90 lines): fetch `/api/config`, render read-only rows (provider / endpoint — show `api.anthropic.com (SDK default)` for anthropic with blank URL / model / masked key), a **Test connection** button POSTing empty body to `/api/config/test`, result line, and hint `t("settings.readonly_hint")`. No forms, no preset dropdown, no model fetch.
- Modify: all 5 locale files — delete keys only used by the old editor (`settings.endpoint_preset`, `settings.fetch_models_btn`, `settings.save_btn`, `settings.save_success`, `settings.save_error`, `settings.restart_required`, `settings.enter_url_key`, `settings.fetch_no_url`, `settings.fetch_failed`, `settings.fetch_no_models`, `settings.fetch_success`, `settings.loading_models`, `settings.no_models`, `settings.select_model`, `settings.failed_models`); keep labels reused for display rows; add:
```json
"settings.readonly_hint": "To change these, edit .env and restart the server."
```
(zh-CN `"如需修改，请编辑 .env 文件后重启服务器。"`; ja-JP `"変更する場合は .env を編集してサーバーを再起動してください。"`; es-ES `"Para cambiar esto, edita .env y reinicia el servidor."`; ko-KR `"변경하려면 .env를 편집하고 서버를 다시 시작하세요."`)
- Modify: tests — `grep -rn "resolveApiKey\|isMaskedApiKey\|POST /api/config\b\|config/models" tests` and delete/adjust those cases.

- [ ] **Step 1:** Server changes → `npx tsc --noEmit`.
- [ ] **Step 2:** Modal rewrite + locales → `npm run typecheck:frontend`, `npx vitest run`.
- [ ] **Step 3:** Manual sanity later (final acceptance); commit `feat!: settings dialog is read-only with a connection test; .env is the source of truth`

---

### Task 5 (D4): Repository hygiene

- [ ] `git branch -d feat/i18n-support phase3-implementation` (both merged — `-d` refuses otherwise)
- [ ] `git push origin --delete master` (April zombie; `origin/main` is HEAD)

---

### Task 6 (C1): Crash-safe saves (tmp + rename)

**Files:**
- Modify: `src/utils/storage.ts:33-48` (`saveGame`)
- Test: `tests/game/storage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
it("leaves no temp file behind after a save", () => {
  storage.saveGame(makeGame("atomic-1"));
  expect(fs.readdirSync(dir)).toEqual(["atomic-1.json"]);
});

it("overwrites an existing save in place", () => {
  storage.saveGame(makeGame("atomic-2", "first"));
  storage.saveGame(makeGame("atomic-2", "second"));
  expect(storage.loadGame("atomic-2")!.name).toBe("second");
  expect(fs.readdirSync(dir)).toEqual(["atomic-2.json"]);
});
```
(`makeGame(id, name?)` = existing fixture helper; if absent, build a minimal `Game` literal.)

- [ ] **Step 2:** `npx vitest run tests/game/storage.test.ts` → new test fails (currently passes trivially — fine) but the rename behavior below must keep both green.
- [ ] **Step 3: Implement** — replace the single writeFileSync:

```ts
// Write beside the target, then rename: a crash mid-write can never leave a
// half-written campaign where the old one was.
const tmpPath = `${filePath}.tmp`;
fs.writeFileSync(tmpPath, JSON.stringify(toWrite, null, 2));
fs.renameSync(tmpPath, filePath); // replaces atomically on Windows too (Node ≥6)
```

- [ ] **Step 4:** `npx vitest run tests/game/storage.test.ts` → PASS. Commit `fix: saves write via temp file + rename so a crash can't corrupt a campaign`

---

### Task 7 (C2): `lastPlayedAt` drives the campaign book

**Files:**
- Modify: `src/types/index.ts` (`Game`: add `lastPlayedAt?: number;` after `createdAt`)
- Modify: `src/utils/storage.ts` — in `saveGame`, before writing: `toWrite.lastPlayedAt = Date.now();`; in `listGames`, return `lastPlayedAt: game.lastPlayedAt ?? game.createdAt` (interface widens) and sort `files` by it descending.
- Modify: `public/js/views/saved-games.ts` — extend `SavedGame` with `lastPlayedAt?: number`; card date line uses `game.lastPlayedAt ?? game.createdAt` under new key `saved_games.last_played`.
- Modify: all 5 locale files: add `"saved_games.last_played"` (en `"Last played: {date}"`; zh `"上次游玩：{date}"`; ja `"最終プレイ：{date}"`; es `"Última partida: {date}"`; ko `"마지막 플레이: {date}"`). Keep `saved_games.date_format` if still referenced, else delete across all 5.

- [ ] **Step 1:** Test first (storage): save a game whose JSON has no `lastPlayedAt`, assert `listGames()` falls back to `createdAt`; re-save and assert it advances past the first value.
- [ ] **Step 2:** Implement; `npx vitest run tests/game/storage.test.ts` → PASS; full suite + both typechecks green.
- [ ] **Step 3: Commit** `feat: campaign book sorts by last played, not creation date`

---

### Task 8 (C3): Rejoin tokens survive server restarts

**Files:**
- Modify: `src/utils/storage.ts` — export `getStorageDir(): string` (the existing `DND_SAVED_GAMES_DIR || cwd/saved_games` logic; reuse it in `ensureStorageDir`).
- Modify: `src/websocket/sessions.ts` — persistence + rewritten header comment.
- Modify: `src/server.ts` — `playerSessions.load()` immediately before `gameStore.loadSavedGames()`.
- Test: extend `tests/websocket/rejoin.test.ts` (or new `tests/websocket/sessions.test.ts`).

- [ ] **Step 1: Failing test**

```ts
describe("session persistence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-sessions-"));
  process.env.DND_SAVED_GAMES_DIR = dir;

  it("tokens survive a fresh registry (server restart)", () => {
    const token = playerSessions.issue("g1", "p1");
    playerSessions.clear();
    playerSessions.load();
    expect(playerSessions.resolve(token)).toEqual({ gameId: "g1", playerId: "p1" });
  });

  it("released tokens are gone from disk too", () => {
    const t2 = playerSessions.issue("g2", "p2");
    playerSessions.release(t2);
    playerSessions.clear();
    playerSessions.load();
    expect(playerSessions.resolve(t2)).toBeUndefined();
  });
});
```

- [ ] **Step 2:** Run → FAIL. Implement in `sessions.ts`:

```ts
import * as fs from "fs";
import * as path from "path";
import { getStorageDir } from "../utils/storage.js";

const SESSIONS_FILE = ".sessions.json";
private file(): string { return path.join(getStorageDir(), SESSIONS_FILE); }

/** Read persisted tokens at startup. Missing/corrupt file → empty, never throws. */
load(): void {
  try {
    const raw = JSON.parse(fs.readFileSync(this.file(), "utf-8")) as Record<string, Seat>;
    for (const [token, seat] of Object.entries(raw)) {
      this.seats.set(token, seat);
      this.tokensBySeat.set(PlayerSessionRegistry.key(seat.gameId, seat.playerId), token);
    }
  } catch { /* first run or bad file: start clean */ }
}

/** Atomic write (tmp+rename), best-effort 0600. Called after every mutation. */
private persist(): void {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = this.file() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.seats)));
  try { fs.chmodSync(tmp, 0o600); } catch { /* POSIX only */ }
  fs.renameSync(tmp, this.file());
}
```
Call `this.persist()` at the end of `issue`, `release`, `releaseGame`. Rewrite the class doc comment: tokens are persisted deliberately for private-LAN play; the file's secrecy class equals `.env` (same disk, same trust boundary); it is never served or broadcast.

- [ ] **Step 3:** Tests green (`npx vitest run tests/websocket`). Ensure `.gitignore` already covers `saved_games/` (it does — sessions file lives inside).
- [ ] **Step 4: Commit** `feat: rejoin tokens persist across server restarts for private play` + update the AGENTS.md "Player identity" note to match.

---

### Task 9 (C4): Save right after every narration

**Files:**
- Modify: `src/game/store.ts` — debounced per-game save; clear pending timers in `cleanupEmptyGames`/`deleteGame`.
- Modify: `src/websocket/handlers/game.ts` — call it after successful `streamOpeningScene` and after the successful `handlePlayerAction` broadcast.

```ts
private pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

/** Persist a game shortly after a narration lands; repeated calls coalesce. */
schedulePostNarrationSave(gameId: string, delayMs = 5000): void {
  clearTimeout(this.pendingSaves.get(gameId));
  this.pendingSaves.set(gameId, setTimeout(() => {
    this.pendingSaves.delete(gameId);
    const engine = this.games.get(gameId);
    if (engine && engine.hasUnsavedChanges) engine.saveGame();
  }, delayMs));
}
```

- [ ] **Step 1:** Test with `vi.useFakeTimers()`: three calls → one save; game deleted before firing → no throw, no save. FAIL first.
- [ ] **Step 2:** Implement + wire the two call sites (after STREAM_END broadcast in `handlePlayerAction`, after success in `streamOpeningScene`). PASS.
- [ ] **Step 3: Commit** `feat: autosave debounces to ~5s after each narration instead of waiting a minute`

---

### Task 10 (C5): Delete the dead snapshot machinery

**Files:**
- Modify: `src/game/store.ts` — delete `Snapshot` interface, `snapshots` Map, `saveSnapshots()`, `startSnapshotTimer()`, `SNAPSHOT_INTERVAL_MS`. Confirm with `grep -rn "snapshot" src tests --include='*.ts' -i` that only these (and no readers) match; fix any test referencing them.
- [ ] Verify `npx tsc --noEmit && npx vitest run` → green. Commit `chore: remove the never-read in-memory snapshot cache`

---

### Task 11 (B1): Idle timeout becomes configurable, default 45s

**Files:**
- Modify: `src/llm/types.ts`

```ts
export const DEFAULT_IDLE_TIMEOUT_MS = 45000;

/** Per-call override → LLM_IDLE_TIMEOUT_MS env → built-in default. */
export function resolveIdleTimeout(override?: number): number {
  if (override && override > 0) return override;
  const fromEnv = Number(process.env.LLM_IDLE_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_IDLE_TIMEOUT_MS;
}
```

- Modify: `src/llm/openai-client.ts` + `src/llm/anthropic-client.ts` — default parameter becomes `resolveIdleTimeout(idleTimeoutMs)` (call it at method top, not in the signature default).
- Modify: `src/game/llm-interaction.ts` — delete `ACTION_STREAM_TIMEOUT_MS` and pass no timeout for action/rest streams (global default applies); `OPENING_STREAM_TIMEOUT_MS = 90000` stays explicit.
- Modify: `.env.example` (`LLM_IDLE_TIMEOUT_MS=45000`) + a paragraph in `docs/LLM-CONFIGURATION.md`.

- [ ] Test: unit for `resolveIdleTimeout` (override wins; env respected; garbage → default). Implement, green, commit `feat: LLM stream idle timeout defaults to 45s and honors LLM_IDLE_TIMEOUT_MS`

---

### Task 12 (B2): Cancel a running narration

**Files:**
- Modify: `src/types/index.ts` — add `'CANCEL_STREAM'` and `'STREAM_CANCELLED'` to MessageType.
- Modify: `src/llm/types.ts` — `streamChat(messages, callbacks, idleTimeoutMs?, signal?: AbortSignal)`.
- Modify: `src/llm/openai-client.ts`, `src/llm/anthropic-client.ts` — honor the external signal; on external abort set a flag so `describeError` returns `new Error("LLM stream cancelled by player")`.
  OpenAI client pattern:
```ts
let userCancelled = false;
if (signal) {
  const onAbort = () => { userCancelled = true; controller.abort(); };
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
}
// in describeError, first branch:
if (userCancelled) return new Error("LLM stream cancelled by player");
```
  Anthropic client: same flag; `onAbort` calls `stream.abort()`.
- Modify: `src/game/engine.ts` — `handlePlayerAction(payload, playerId, callbacks, signal?)` → forwards to `narration.handlePlayerAction(..., signal)`; same plumbing in `LLMInteractionService.handlePlayerAction` (4th param → `this.llmClient.streamChat(..., ACTION idle = undefined, signal)`). Opening scene: **no** cancel support (retry logic owns it) — say so in a comment.
- Modify: `src/websocket/handlers/game.ts`:

```ts
/** One live narration per player; cancelled via CANCEL_STREAM from that same socket. */
const activeStreams = new Map<string, AbortController>(); // `${gameId}:${playerId}`
```
In `handlePlayerAction`: create controller **before** the engine call; accumulate partial text in the onChunk wrapper (`partial += chunk`); `finally { activeStreams.delete(key); }`. In the catch: if `message.includes("cancelled by player")` → persist what streamed (see below) then broadcast `"STREAM_CANCELLED", { playerId }`; else current STREAM_ERROR path (Task 13 reshapes it).

```ts
// A cancelled turn keeps its story: whatever streamed becomes the narrative.
const text = parseLLMResponse(partial).fullNarrative.trim();
if (text) engine.persistCancelledNarrative(text);
```
New `GameEngine` method delegating to a new public `LLMInteractionService.persistCancelledNarrative(text)` that pushes a `narrative` ChatMessage (no conversationHistory entry — the DM never finished thinking; document that).

New handler:
```ts
function handleCancelStream(ctx: HandlerContext): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;
  activeStreams.get(`${resolved.engine.id}:${ctx.client.playerId!}`)?.abort();
}
```
Register `CANCEL_STREAM` in `gameHandlers`. No rate-limit budget (it triggers no LLM call).

- Modify: `public/js/app.ts` — while a stream is live for the current player, show a **Stop** control next to the composer; click sends `{ type: "CANCEL_STREAM", payload: {} }`. On `STREAM_CANCELLED`: clear stream buffer/display. Track liveness from STREAM_CHUNK (own game) → true; STREAM_END/ERROR/CANCELLED → false.
- Locale keys ×5: `"stream.stop.btn"` (`"Stop"` / `"停止"` / `"停止"` / `"Detener"` / `"중지"`).

- [ ] TDD: unit test the openai client with a fake fetch streaming slowly + external abort → rejects with "cancelled by player"; handler-level test that CANCEL_STREAM aborts and STREAM_CANCELLED broadcasts (follow `tests/websocket/` patterns). Then frontend, typechecks, commit `feat: players can stop a running narration; partial story is kept`

---

### Task 13 (B3): Failures are error cards with Retry, not fake stories

**Files:**
- Modify: `src/websocket/handlers/game.ts` — in `handlePlayerAction` catch: delete `engine.addEvent("DM", fallback)`; broadcast `"STREAM_ERROR", { message }` (drop `fallbackNarrative`). Opening-scene fallback stays (documented exception).
- Modify: `public/js/game-state.ts` — add `lastPlayerAction: { action: string; dice?: ... } | null` with setter/getter.
- Modify: `public/js/action-bar.ts` — set `gameState.lastPlayerAction` right before sending PLAYER_ACTION.
- Modify: `public/js/app.ts` STREAM_ERROR handler — always render a chat message `{ id: "stream-error", type: "error", content: t("stream_error.title") + ": " + p.message }`; drop the old narrative-masquerade branch and unused keys.
- Modify: `public/js/views/chat.ts` — for `id === "stream-error"` render a Retry button; delegated click → resend `gameState.lastPlayerAction` (if present) via PLAYER_ACTION and remove the card node.
- Locale keys ×5: `"stream_error.title"` (`"The Dungeon Master lost the thread"` / `"地下城主失去了线索"` / `"DM が思考を見失いました"` / `"El DM perdió el hilo"` / `"DM이 흐름을 잃었습니다"`), `"stream_error.retry"` (`"Retry"` / `"重试"` / `"再試行"` / `"Reintentar"` / `"재시도"`). Remove now-unused `stream_error.fallback` ×5.

- [ ] TDD where possible (chat view render test exists under tests/frontend — extend). Manual e2e in Task 16. Commit `fix!: LLM failures show a retryable error card instead of fake narration`

---

### Task 14 (B4): Reconnection banner

**Files:**
- Modify: `public/js/websocket.ts` — on `onclose`, always `triggerHandlers("connection-lost", { attempt })`; on successful `onopen` after a prior loss, trigger `"connection-restored"`. Keep the existing max-attempts `disconnect` event.
- Modify: `public/js/app.ts` — inject `<div id="connection-banner" class="connection-banner hidden">…</div>` once; on `connection-lost` show `t("connection.lost")`; on `connection-restored` hide + success toast `t("connection.restored")`. Keep the existing disconnect notification for max attempts.
- Modify: `public/css/style.css` — `.connection-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 100; text-align: center; padding: .4rem 1rem; background: var(--rust, #8c2f2f); color: #fff; }` + `.hidden { display: none; }` (reuse existing hidden class if present).
- Locale keys ×5: `"connection.lost"` (`"Connection lost — reconnecting…"` / `"连接丢失——正在重连…"` / `"接続が切れました——再接続中…"` / `"Conexión perdida — reintentando…"` / `"연결 끊김 — 재접속 중…"`), `"connection.restored"` (`"Reconnected"` / `"已重新连接"` / `"再接続しました"` / `"Reconectado"` / `"재접속됨"`).

- [ ] `npm run typecheck:frontend` green; commit `feat: a persistent banner shows while the socket is down`

---

### Task 15 (B5): E2E — stub failure/delay modes, cancel flow, retry flow

**Files:**
- Modify: `tests/e2e/stub-llm.mjs` — buffer the request body; if it contains `"TRIGGER FAILURE"` → respond 500 (`{"error":"stub failure"}`). Add pacing: `const CHUNK_DELAY_MS = Number(process.env.STUB_CHUNK_DELAY_MS || 0);` awaited between SSE writes.
- Modify: `playwright.config.ts` — set `STUB_CHUNK_DELAY_MS: "40"` in the stub's env (keeps ~2s streams, cancellable).
- Modify: `tests/e2e/game.spec.ts` — append flows:

```ts
test("flow 9 — a running narration can be stopped", async ({ page }) => {
  await createGame(page, `Smoke: Cancel ${Date.now()}`);
  await waitForOpeningScene(page);
  await page.fill("#action-input", "I light my torch and listen at the door");
  await page.press("#action-input", "Enter");
  const stop = page.locator("#stop-stream-btn");
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(stop).toHaveCount(0);
  // The composer works again right away.
  await expect(page.locator("#action-input")).toBeEditable();
});

test("flow 10 — an LLM failure shows a retry card, not a fake story", async ({ page }) => {
  await createGame(page, `Smoke: Retry ${Date.now()}`);
  await waitForOpeningScene(page);
  await page.fill("#action-input", "TRIGGER FAILURE");
  await page.press("#action-input", "Enter");
  const card = page.locator(".message.error");
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: /retry|重试/i })).toBeVisible();
});
```

- [ ] `npx playwright test` → all flows green (existing 8 + new). Commit `test: e2e coverage for cancel, failure-retry card against a programmable stub`

---

### Task 16: Final gate + push

- [ ] `npm run typecheck && npx vitest run && npm run build` → all green.
- [ ] `npx playwright test` → all flows green.
- [ ] Manual smoke (owner machine): double-click start, create game, narrate, stop mid-stream, kill server (`stop.bat`), restart, open invite link → seat reclaimed; campaign book shows last played.
- [ ] Update AGENTS.md architecture notes where behavior changed (sessions persistence, settings read-only, autosave cadence, idle timeout).
- [ ] `git push origin main`.

---

## Out of scope (do not touch)

Auth beyond invite links/seat tokens · databases · Docker · hot-reload config · internet-facing hardening · Phase A visual atmosphere (separate brief after this ships).
