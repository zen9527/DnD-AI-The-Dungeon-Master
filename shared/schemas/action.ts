import { z } from "zod";

/**
 * The preset action buttons. The `action` text a player sends is localized, so
 * it cannot be keyword-matched; this id travels alongside it and is what the
 * rules engine keys the skill check off.
 */
export const presetActionIds = ["attack", "search", "talk", "hide", "arcana", "defend"] as const;
export const presetActionIdSchema = z.enum(presetActionIds);
export type PresetActionId = (typeof presetActionIds)[number];

export const playerActionSchema = z.object({
  action: z.string().min(1).max(500),
  actionId: presetActionIdSchema.optional(),
  dice: z.object({
    type: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20)]),
    count: z.number().int().min(1).max(10),
    modifier: z.number().optional(),
  }).optional(),
  target: z.string().max(100).optional(),
  helpers: z.array(z.string()).optional(), // NEW - Player IDs helping on this check
});

export type PlayerActionInput = z.infer<typeof playerActionSchema>;
