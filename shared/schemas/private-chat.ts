import { z } from "zod";

export const privateChatSchema = z.object({
  targetPlayerId: z.string().min(1),
  content: z.string().min(1).max(500),
});

export type PrivateChatInput = z.infer<typeof privateChatSchema>;
