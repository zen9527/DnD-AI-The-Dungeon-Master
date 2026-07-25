import { z } from "zod";

export const applyTemporaryHpSchema = z.object({
  targetId: z.string().min(1),
  isPlayer: z.boolean(),
  amount: z.number().int().min(1),
  duration: z.number().int().min(1),
});

export type ApplyTemporaryHpInput = z.infer<typeof applyTemporaryHpSchema>;

export const applyBuffSchema = z.object({
  targetId: z.string().min(1),
  isPlayer: z.boolean(),
  buff: z.object({
    name: z.string().min(1).max(100),
    effect: z.string().min(1).max(200),
    bonus: z.number().optional(),
    duration: z.number().int().min(1),
  }),
});

export type ApplyBuffInput = z.infer<typeof applyBuffSchema>;

export const removeBuffSchema = z.object({
  targetId: z.string().min(1),
  isPlayer: z.boolean(),
  buffName: z.string().min(1),
});

export type RemoveBuffInput = z.infer<typeof removeBuffSchema>;
