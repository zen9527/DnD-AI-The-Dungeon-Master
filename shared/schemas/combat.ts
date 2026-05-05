import { z } from "zod";

// Combat mode control
export const combatStartSchema = z.object({
  startInitiative: z.boolean().optional(), // Auto-roll initiative for all participants
});

export type CombatStartInput = z.infer<typeof combatStartSchema>;

// Combat end
export const combatEndSchema = z.object({});
export type CombatEndInput = z.infer<typeof combatEndSchema>;

// Individual initiative roll (for late joiners or new NPCs)
export const initiativeRollSchema = z.object({
  entityId: z.string(), // Player ID or NPC ID
  isPlayer: z.boolean(),
});

export type InitiativeRollInput = z.infer<typeof initiativeRollSchema>;

// Advance combat turn
export const turnAdvanceSchema = z.object({});
export type TurnAdvanceInput = z.infer<typeof turnAdvanceSchema>;

// Combat state update
export const combatStateSchema = z.object({
  combatMode: z.boolean(),
  initiativeOrder: z.array(z.object({
    playerId: z.string().optional(),
    npcId: z.string().optional(),
    score: z.number(),
    name: z.string(),
    hp: z.number(),
    maxHp: z.number(),
    ac: z.number(),
    isPlayer: z.boolean(),
  })),
  currentRound: z.number(),
  currentTurnIndex: z.number(),
  currentPlayerName: z.string().optional(),
});

export type CombatStateOutput = z.infer<typeof combatStateSchema>;
