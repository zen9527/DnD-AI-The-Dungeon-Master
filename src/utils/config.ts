import fs from "fs";
import { llmProviderSchema, type LLMProviderId } from "../../shared/schemas/config.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ConfigManager reads .env fresh at runtime instead of caching process.env.
 * This eliminates initialization order bugs where GameStore singleton cached
 * incorrect .env values before the server loaded them.
 */
export class ConfigManager {
  private envPath: string;

  constructor(envPath?: string) {
    // Default to project root .env - find it by walking up from current location
    if (envPath) {
      this.envPath = envPath;
    } else {
      // Start from process.cwd() which is where the server runs from
      const cwd = process.cwd();
      let foundPath: string | undefined;

      const possiblePaths = [
        path.join(cwd, ".env"),
        path.join(cwd, "dist", ".env"),
        path.join(__dirname, "../..", ".env"),
      ];

      // Use first .env that exists
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          foundPath = p;
          break;
        }
      }

      // Fallback to process.cwd()/.env if none found
      this.envPath = foundPath || path.join(cwd, ".env");
    }
  }

  /**
   * Read LLM configuration directly from .env file.
   * Returns fresh values every time — not cached from process.env.
   */
  read(): {
    llmBaseUrl: string;
    llmApiKey: string | null;
    llmModel: string;
    llmProvider: LLMProviderId;
    port: string;
    host: string;
  } {
    const envContent = fs.existsSync(this.envPath)
      ? fs.readFileSync(this.envPath, "utf-8")
      : "";

    const envVars: Record<string, string> = {};
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) envVars[key.trim()] = rest.join("=").trim();
    }

    const provider = llmProviderSchema.safeParse(envVars.LLM_PROVIDER);

    return {
      llmBaseUrl: envVars.LLM_API_URL || "http://localhost:1234/v1",
      llmApiKey: envVars.LLM_API_KEY || null,
      llmModel: envVars.LLM_MODEL || "local-model",
      // Unset or unrecognized falls back to the OpenAI-compatible protocol.
      llmProvider: provider.success ? provider.data : "openai-compatible",
      port: envVars.PORT || "3000",
      host: envVars.HOST || "0.0.0.0",
    };
  }

  /**
   * Write updated LLM configuration to .env file.
   * Used by the config API POST endpoint.
   */
  write(config: { llmBaseUrl: string; llmApiKey: string | null; llmModel: string; llmProvider?: LLMProviderId }): void {
    let content = fs.readFileSync(this.envPath, "utf-8");

    content = upsertEnvVar(content, "LLM_PROVIDER", config.llmProvider ?? "openai-compatible");
    content = upsertEnvVar(content, "LLM_API_URL", config.llmBaseUrl);
    content = upsertEnvVar(content, "LLM_API_KEY", config.llmApiKey ?? "");
    content = upsertEnvVar(content, "LLM_MODEL", config.llmModel);

    fs.writeFileSync(this.envPath, content, "utf-8");
  }

  /**
   * Get the path to the .env file for logging/debugging.
   */
  getEnvPath(): string {
    return this.envPath;
  }
}

/**
 * Set `KEY=value` in a .env body, replacing an existing *active* assignment or
 * appending one.
 *
 * The commented-out examples in `.env.example` are why this can't be a simple
 * substring check: `LLM_MODEL=` appears in `# LLM_MODEL=gpt-4`, so a
 * "contains, therefore replace" approach finds nothing to replace on the
 * anchored pattern and silently drops the value.
 */
function upsertEnvVar(content: string, key: string, value: string): string {
  const assignment = new RegExp(`^${key}=.*$`, "m");

  if (assignment.test(content)) {
    return content.replace(assignment, `${key}=${value}`);
  }

  const separator = content.endsWith("\n") || content.length === 0 ? "" : "\n";
  return `${content}${separator}${key}=${value}\n`;
}

// Export singleton instance for use across the project
export const configManager = new ConfigManager();
