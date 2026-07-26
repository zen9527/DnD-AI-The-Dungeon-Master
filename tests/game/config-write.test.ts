import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ConfigManager } from "../../src/utils/config.js";

/**
 * Guards the .env round-trip. The commented-out provider examples in
 * `.env.example` are the hazard here: a naive "does the file contain
 * LLM_MODEL=?" check matches `# LLM_MODEL=gpt-4`, and the anchored replace
 * then does nothing — silently dropping the setting.
 */
describe("ConfigManager.write", () => {
  let dir: string;
  let envPath: string;
  let manager: ConfigManager;

  const settings = {
    llmBaseUrl: "https://api.anthropic.com",
    llmApiKey: "sk-ant-test",
    llmModel: "claude-opus-5",
    llmProvider: "anthropic" as const,
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-config-"));
    envPath = path.join(dir, ".env");
    manager = new ConfigManager(envPath);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes every setting into an empty .env", () => {
    fs.writeFileSync(envPath, "");

    manager.write(settings);

    const written = fs.readFileSync(envPath, "utf8");
    expect(written).toContain("LLM_PROVIDER=anthropic");
    expect(written).toContain("LLM_API_KEY=sk-ant-test");
    expect(written).toContain("LLM_MODEL=claude-opus-5");
  });

  it("replaces existing assignments rather than appending duplicates", () => {
    fs.writeFileSync(envPath, "LLM_PROVIDER=openai-compatible\nLLM_MODEL=glm-4.5-air\nPORT=3000\n");

    manager.write(settings);

    const written = fs.readFileSync(envPath, "utf8");
    expect(written.match(/^LLM_MODEL=/gm)).toHaveLength(1);
    expect(written).toContain("LLM_MODEL=claude-opus-5");
    expect(written).toContain("PORT=3000"); // unrelated settings survive
  });

  it("does not treat a commented-out example as the active assignment", () => {
    fs.writeFileSync(envPath, "# LLM_MODEL=gpt-4\n# LLM_PROVIDER=anthropic\nPORT=3000\n");

    manager.write(settings);

    const written = fs.readFileSync(envPath, "utf8");
    expect(written).toContain("# LLM_MODEL=gpt-4"); // comment left alone
    expect(written).toContain("LLM_MODEL=claude-opus-5"); // real value still written
    expect(manager.read().llmModel).toBe("claude-opus-5");
  });

  it("round-trips the provider through read()", () => {
    fs.writeFileSync(envPath, "");

    manager.write(settings);

    const config = manager.read();
    expect(config.llmProvider).toBe("anthropic");
    expect(config.llmModel).toBe("claude-opus-5");
  });

  it("falls back to openai-compatible for an unrecognized provider", () => {
    fs.writeFileSync(envPath, "LLM_PROVIDER=gemini\n");

    expect(manager.read().llmProvider).toBe("openai-compatible");
  });
});
