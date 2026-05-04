import { z } from "zod";

export const emoteSchema = z.object({
  action: z.string().min(1).max(200),
});

export type EmoteInput = z.infer<typeof emoteSchema>;
