import { z } from "zod";
export declare const chatMessageSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
//# sourceMappingURL=chat.d.ts.map