import fs from "fs";
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

    return {
      llmBaseUrl: envVars.LLM_API_URL || "http://localhost:1234/v1",
      llmApiKey: envVars.LLM_API_KEY || null,
      llmModel: envVars.LLM_MODEL || "local-model",
      port: envVars.PORT || "3000",
      host: envVars.HOST || "0.0.0.0",
    };
  }

  /**
   * Write updated LLM configuration to .env file.
   * Used by the config API POST endpoint.
   */
  write(config: { llmBaseUrl: string; llmApiKey: string | null; llmModel: string }): void {
    let content = fs.readFileSync(this.envPath, "utf-8");

    // Update or add each variable
    if (content.includes("LLM_API_URL=")) {
      content = content.replace(/^LLM_API_URL=.*/mi, `LLM_API_URL=${config.llmBaseUrl}`);
    } else {
      content += `\nLLM_API_URL=${config.llmBaseUrl}`;
    }

    if (content.includes("LLM_API_KEY=")) {
      content = content.replace(/^LLM_API_KEY=.*/mi, `LLM_API_KEY=${config.llmApiKey ?? ""}`);
    } else {
      content += `\nLLM_API_KEY=${config.llmApiKey ?? ""}`;
    }

    if (content.includes("LLM_MODEL=")) {
      content = content.replace(/^LLM_MODEL=.*/mi, `LLM_MODEL=${config.llmModel}`);
    } else {
      content += `\nLLM_MODEL=${config.llmModel}`;
    }

    fs.writeFileSync(this.envPath, content, "utf-8");
  }

  /**
   * Get the path to the .env file for logging/debugging.
   */
  getEnvPath(): string {
    return this.envPath;
  }
}

// Export singleton instance for use across the project
export const configManager = new ConfigManager();
