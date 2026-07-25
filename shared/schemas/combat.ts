import { z } from "zod";

// Combat mode control
export const combatStartSchema = z.object({
  startInitiative: z.boolean().optional(), // Auto-roll initiative for all participants
});

export type CombatStartInput = z.infer<typeof combatStartSchema>;

// Individual initiative roll (for late joiners or new NPCs)
export const initiativeRollSchema = z.object({
  entityId: z.string(), // Player ID or NPC ID
  isPlayer: z.boolean(),
});

export type InitiativeRollInput = z.infer<typeof initiativeRollSchema>;
