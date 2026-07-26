// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const notifications: Array<{ text: string; type: string }> = [];

vi.mock("../../../public/js/i18n.js", () => ({
  t: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${Object.values(params).join(",")}` : key,
}));

vi.mock("../../../public/js/utils.js", () => ({
  escapeHtml: (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;"),
  showNotification: (text: string, type: string) => notifications.push({ text, type }),
}));

const { SavedGamesView } = await import("../../../public/js/views/saved-games.js");

const SAVES = [
  { id: "g1", name: "The Sunless Citadel", createdAt: Date.UTC(2026, 4, 1) },
  { id: "g2", name: "Barrow of the Frost Giant", createdAt: Date.UTC(2026, 5, 12) },
];

let onLoad: ReturnType<typeof vi.fn>;
let view: InstanceType<typeof SavedGamesView>;

beforeEach(() => {
  notifications.length = 0;
  document.body.innerHTML = `
    <section id="saved-games-section" style="display:none">
      <div id="saved-games-container"></div>
    </section>`;
  onLoad = vi.fn();
  view = new SavedGamesView(onLoad);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("SavedGamesView", () => {
  it("renders a card per save and reveals the section", () => {
    view.render(SAVES);

    expect(document.querySelectorAll(".game-card.saved-game")).toHaveLength(2);
    expect(document.body.textContent).toContain("The Sunless Citadel");
    expect(document.getElementById("saved-games-section")?.style.display).toBe("block");
  });

  it("shows an empty state rather than a blank panel", () => {
    view.render([]);

    expect(document.querySelector(".no-games")).not.toBeNull();
    expect(document.querySelectorAll(".game-card")).toHaveLength(0);
  });

  it("escapes save names instead of rendering them as markup", () => {
    view.render([{ id: "g1", name: "<img src=x onerror=alert(1)>", createdAt: Date.now() }]);

    expect(document.querySelector("#saved-games-container img")).toBeNull();
    expect(document.body.textContent).toContain("<img");
  });

  it("reports which save the player chose, and loads nothing itself", () => {
    view.render(SAVES);

    document.querySelectorAll<HTMLElement>(".load-saved-btn")[1].dispatchEvent(new Event("click"));

    expect(onLoad).toHaveBeenCalledWith("g2");
  });

  it("asks before deleting and honours a refusal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    view.render(SAVES);

    document.querySelector<HTMLElement>(".delete-saved-btn")!.dispatchEvent(new Event("click"));
    await Promise.resolve();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".game-card")).toHaveLength(2);
  });

  it("removes the card once the server confirms the delete", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    view.render(SAVES);

    document.querySelector<HTMLElement>(".delete-saved-btn")!.dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(document.querySelectorAll(".game-card")).toHaveLength(1));

    expect(notifications.at(-1)?.type).toBe("success");
  });

  it("keeps the card and says so when the delete fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "locked" }), { status: 500 })
    );
    view.render(SAVES);

    document.querySelector<HTMLElement>(".delete-saved-btn")!.dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(notifications.at(-1)?.type).toBe("error"));

    expect(document.querySelectorAll(".game-card")).toHaveLength(2);
  });

  it("falls back to the empty state after the last save is deleted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    view.render([SAVES[0]]);

    document.querySelector<HTMLElement>(".delete-saved-btn")!.dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(document.querySelector(".no-games")).not.toBeNull());

    expect(document.getElementById("saved-games-section")?.style.display).toBe("none");
  });

  it("survives the saved-games API being unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(view.refresh()).resolves.toBeUndefined();
  });
});
