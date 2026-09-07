import { test, expect, type Page } from "@playwright/test";

/**
 * Ten flows through the real browser against the real server.
 *
 * Everything below has been broken at some point without a single unit test
 * failing: the action bar rendered but sent nothing, the DM panel stayed empty
 * because the snapshot was stale, streaming showed one token at a time, a
 * refresh replaced your character with a stranger, and a rate limiter silently
 * refused the create button, the lobby listed nothing, and the DM's own button
 * covered the "Act" button on a phone. Those are all one click deep — which is
 * exactly the depth no other test in this repo reaches.
 *
 * The DM is a stub (tests/e2e/stub-llm.mjs), so the narrative is fixed.
 */

/** A phrase only the stub DM ever writes. */
const STUB_NARRATIVE = "torchlight gutters";

/** Walk the create-game flow and land in the game UI. Returns the game id. */
async function createGame(page: Page, gameName: string): Promise<string> {
  await page.goto("/");

  await page.locator("#create-game-btn").click();
  await page.locator('.scenario-card[data-scenario="dungeon"]').click();

  await expect(page.locator("#create-game-form")).toBeVisible();
  await page.locator("#game-name").fill(gameName);
  await page.locator("#player-name").fill("E2E Player");
  await page.locator("#character-name").fill("Ranulf");
  await page.locator('#create-game-form button[type="submit"]').click();

  // The game shell replaces the form, and the URL gains the shareable id.
  await expect(page.locator(".game-interface")).toBeVisible();
  await expect(page).toHaveURL(/\?game=\w+/);

  return new URL(page.url()).searchParams.get("game")!;
}

/** The DM's opening scene arrives ~5s after creation; wait it out. */
async function waitForOpeningScene(page: Page): Promise<void> {
  await expect(page.locator("#chat-messages")).toContainText(STUB_NARRATIVE, { timeout: 40_000 });
}

test("flow 1 — creating a game reaches the table with the DM's opening scene", async ({ page }) => {
  await createGame(page, "Smoke: Create");

  // The three panels that make the screen a game rather than a blank shell.
  await expect(page.locator(".players-panel .character-name").filter({ hasText: "Ranulf" })).toBeVisible();
  await expect(page.locator(".action-bar #action-input")).toBeVisible();
  await waitForOpeningScene(page);
});

test("flow 2 — taking a turn echoes the action and streams a reply", async ({ page }) => {
  await createGame(page, "Smoke: Turn");
  await waitForOpeningScene(page);

  await page.locator("#action-input").fill("I push against the portcullis");
  await page.locator("#action-submit").click();

  // The player's own line lands first, then the DM answers it.
  await expect(page.locator("#chat-messages")).toContainText("I push against the portcullis");
  await expect(page.locator("#chat-messages .message.narrative")).toHaveCount(2, { timeout: 40_000 });

  // The input clears so the next turn can be typed straight away.
  await expect(page.locator("#action-input")).toHaveValue("");
});

test("flow 3 — rolling a d20 puts a server-rolled result in the log", async ({ page }) => {
  await createGame(page, "Smoke: Dice");
  await waitForOpeningScene(page);

  await page.locator("#dice-modifier").fill("3");
  await page.locator('.dice-btn[data-dice="20"]').click();

  const roll = page.locator("#chat-messages .message.roll").last();
  await expect(roll).toContainText("d20:");

  // The result has to be a real number in range — 1..20 plus the +3 modifier.
  const text = await roll.locator(".message-content").innerText();
  const total = Number(text.match(/d20:\s*(-?\d+)/)![1]);
  expect(total).toBeGreaterThanOrEqual(4);
  expect(total).toBeLessThanOrEqual(23);
});

test("flow 4 — a refresh reclaims your seat instead of making a new character", async ({ page }) => {
  await createGame(page, "Smoke: Rejoin");
  await waitForOpeningScene(page);

  await page.reload();

  await expect(page.locator(".game-interface")).toBeVisible();
  await expect(page.locator(".notification")).toContainText("Welcome back");
  // The same character, and only one of them.
  await expect(page.locator(".players-panel .player-status")).toHaveCount(1);
  await expect(page.locator(".players-panel .character-name").filter({ hasText: "Ranulf" })).toBeVisible();
  // History survived the reload rather than restarting the campaign.
  await expect(page.locator("#chat-messages")).toContainText(STUB_NARRATIVE);
});

test("flow 5 — switching language re-renders in place without dropping the socket", async ({ page }) => {
  await createGame(page, "Smoke: Locale");
  await waitForOpeningScene(page);

  // A marker that only survives if the page is never reloaded.
  await page.evaluate(() => { (window as unknown as { e2eMarker: boolean }).e2eMarker = true; });

  await page.locator("#locale-select").selectOption("zh-CN");

  await expect(page.locator("#save-game-btn")).toContainText("保存");
  await expect(page.locator("#load-game-btn")).toContainText("读取");
  expect(await page.evaluate(() => (window as unknown as { e2eMarker?: boolean }).e2eMarker)).toBe(true);

  // Still connected: the action bar answers after the rebuild.
  await page.locator("#action-input").fill("我举起火把");
  await page.locator("#action-submit").click();
  await expect(page.locator("#chat-messages")).toContainText("我举起火把");
});

test("flow 6 — the campaign book lists saved games and a code joins them", async ({ page }) => {
  const gameName = `Smoke: Book ${Date.now()}`;
  await createGame(page, gameName);
  await waitForOpeningScene(page);

  // The campaign book reads the disk, so save first.
  await page.locator("#save-game-btn").click();
  await expect(page.locator(".notification")).toContainText("Game saved");
  const gameId = new URL(page.url()).searchParams.get("game")!;

  // Arrive fresh, the way a second player would: the book shows the campaign.
  await page.goto("/");
  const card = page.locator("#saved-games-container .game-card", { hasText: gameName });
  await expect(card).toBeVisible();

  // And the join-by-code field reaches the same table — as a stranger does,
  // without the creator's rejoin token in localStorage (with it, the app
  // correctly reclaims the seat instead of offering the join form).
  await page.evaluate(() => window.localStorage.clear());
  await page.locator("#game-id-input").fill(gameId);
  await page.locator("#join-game-btn").click();
  await expect(page.locator("#join-form")).toBeVisible();
});

test("flow 7 — the phone layout fits, with the party, story and composer all reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await createGame(page, "Smoke: Phone");
  await waitForOpeningScene(page);

  // Nothing may push the page sideways — the old fixed 280px rail did.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBe(overflow.clientWidth);

  await expect(page.locator(".players-panel .character-name").filter({ hasText: "Ranulf" })).toBeVisible();
  await expect(page.locator("#action-input")).toBeInViewport();
  await expect(page.locator("#chat-messages")).toContainText(STUB_NARRATIVE);

  // The pack opens as a sheet rather than a column that has nowhere to go.
  await page.locator("#inventory-btn").click();
  await expect(page.locator("#inventory-panel")).toBeVisible();
  await expect(page.locator("#inventory-panel")).toBeInViewport();

  // The sheet covers the composer, so it has to close again — the same
  // button opens and closes it.
  await page.locator("#inventory-btn").click();
  await expect(page.locator("#inventory-panel")).toBeHidden();

  // And a turn still goes through at this size.
  await page.locator("#action-input").fill("I listen at the portcullis");
  await page.locator("#action-submit").click();
  await expect(page.locator("#chat-messages")).toContainText("I listen at the portcullis");
});

test("flow 8 — save writes to disk and load restores it", async ({ page }) => {
  await createGame(page, "Smoke: Save");
  await waitForOpeningScene(page);

  await page.locator("#action-input").fill("I map the chamber");
  await page.locator("#action-submit").click();
  await expect(page.locator("#chat-messages")).toContainText("I map the chamber");

  await page.locator("#save-game-btn").click();
  await expect(page.locator(".notification")).toContainText("Game saved");

  await page.locator("#load-game-btn").click();
  await expect(page.locator(".notification")).toContainText("Game loaded");

  // Loading restores the table rather than blanking it — the bug this replaced
  // was a client-side location.reload() that never loaded anything.
  await expect(page.locator("#chat-messages")).toContainText("I map the chamber");
  await expect(page.locator(".players-panel .character-name").filter({ hasText: "Ranulf" })).toBeVisible();
});

test("flow 9 — Stop keeps what has streamed and closes the stream", async ({ page }) => {
  await createGame(page, "Smoke: Cancel");
  await waitForOpeningScene(page);

  await page.locator("#action-input").fill("I whisper a word to the dark");
  await page.locator("#action-submit").click();

  // Stop lives only while something is actually streaming. The stub replies at
  // ~80ms per chunk, so there is a window to catch it mid-sentence.
  const stop = page.locator("#stop-stream-btn");
  await expect(stop).toBeVisible();
  await expect(page.locator("#stream-display")).toContainText("torchlight", { timeout: 10_000 });
  await stop.click();

  // What arrived becomes a real narrative message...
  await expect(page.locator("#chat-messages .message.narrative").last()).toContainText("torchlight");
  // ...and the live stream view is dismantled.
  await expect(page.locator("#stream-display")).toBeEmpty();
  await expect(stop).toBeHidden();
});

test("flow 10 — a failed DM reply shows an honest error card that can retry", async ({ page }) => {
  await createGame(page, "Smoke: Retry");
  await waitForOpeningScene(page);

  // The stub fails the first request carrying this marker, then heals.
  await page.locator("#action-input").fill("TRIGGER FAILURE — open the sealed door");
  await page.locator("#action-submit").click();

  const card = page.locator("#chat-messages .message.error");
  await expect(card).toBeVisible({ timeout: 20_000 });
  // No invented story went on the record — only the fault and a way back.
  await expect(page.locator("#chat-messages .message.narrative")).toHaveCount(1);

  await card.locator(".retry-stream-btn").click();

  // The retry resends the same turn; this time the DM answers, card gone.
  await expect(page.locator("#chat-messages .message.error")).toHaveCount(0);
  await expect(page.locator("#chat-messages .message.narrative").last()).toContainText(STUB_NARRATIVE, { timeout: 40_000 });
});
