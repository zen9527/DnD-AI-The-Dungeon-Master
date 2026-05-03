/**
 * ConfigManager reads .env fresh at runtime instead of caching process.env.
 * This eliminates initialization order bugs where GameStore singleton cached
 * incorrect .env values before the server loaded them.
 */
export declare class ConfigManager {
    private envPath;
    constructor(envPath?: string);
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
    };
    /**
     * Write updated LLM configuration to .env file.
     * Used by the config API POST endpoint.
     */
    write(config: {
        llmBaseUrl: string;
        llmApiKey: string | null;
        llmModel: string;
    }): void;
    /**
     * Get the path to the .env file for logging/debugging.
     */
    getEnvPath(): string;
}
export declare const configManager: ConfigManager;
//# sourceMappingURL=config.d.ts.map