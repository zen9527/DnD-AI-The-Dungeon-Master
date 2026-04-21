import { z } from "zod";

export const chatMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
