import { z } from "zod";
export declare const configSchema: z.ZodObject<{
    llmBaseUrl: z.ZodString;
    llmApiKey: z.ZodString;
    llmModel: z.ZodString;
}, "strip", z.ZodTypeAny, {
    llmBaseUrl: string;
    llmApiKey: string;
    llmModel: string;
}, {
    llmBaseUrl: string;
    llmApiKey: string;
    llmModel: string;
}>;
export type ConfigInput = z.infer<typeof configSchema>;
export declare const endpointPresets: readonly [{
    readonly name: "LM Studio";
    readonly url: "http://localhost:1234/v1";
    readonly apiKey: "";
    readonly model: "";
}, {
    readonly name: "Ollama";
    readonly url: "http://localhost:11434/v1";
    readonly apiKey: "";
    readonly model: "";
}, {
    readonly name: "OpenAI";
    readonly url: "https://api.openai.com/v1";
    readonly apiKey: "";
    readonly model: "gpt-4";
}, {
    readonly name: "Together AI";
    readonly url: "https://api.together.xyz/v1";
    readonly apiKey: "";
    readonly model: "meta-llama/Meta-Llama-3-8B-Instruct-Turbo";
}, {
    readonly name: "Groq";
    readonly url: "https://api.groq.com/openai/v1";
    readonly apiKey: "";
    readonly model: "llama3-70b-8192";
}, {
    readonly name: "BigModel (GLM)";
    readonly url: "https://open.bigmodel.cn/api/paas/v4";
    readonly apiKey: "";
    readonly model: "";
}, {
    readonly name: "Custom";
    readonly url: "";
    readonly apiKey: "";
    readonly model: "";
}];
export type EndpointPreset = (typeof endpointPresets)[number];
//# sourceMappingURL=config.d.ts.map