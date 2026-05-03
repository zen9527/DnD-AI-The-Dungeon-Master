export interface LLMCallbacks {
    onChunk: (chunk: string) => void;
    onEnd: (fullContent: string) => void;
    onError: (error: Error) => void;
}
export declare class LLMClient {
    private baseUrl;
    private apiKey;
    private model;
    constructor(baseUrl: string, apiKey: string | null, model: string);
    private getHeaders;
    streamChat(messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }>, callbacks: LLMCallbacks, idleTimeoutMs?: number): Promise<string>;
}
//# sourceMappingURL=client.d.ts.map