import { z } from "zod";

// Supported combat conditions in D&D 5e
export const conditionOptions = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;

// NPC Update HP
export const npcUpdateHpSchema = z.object({
  npcId: z.string(),
  newHp: z.number().int(),
});

export type NPCUpdateHpInput = z.infer<typeof npcUpdateHpSchema>;

// NPC Apply Condition
export const npcApplyConditionSchema = z.object({
  npcId: z.string(),
  condition: z.enum(conditionOptions),
});

export type NPCApplyConditionInput = z.infer<typeof npcApplyConditionSchema>;

// NPC Remove Condition
export const npcRemoveConditionSchema = z.object({
  npcId: z.string(),
  condition: z.enum(conditionOptions),
});

export type NPCRemoveConditionInput = z.infer<typeof npcRemoveConditionSchema>;

// NPC Delete
export const npcDeleteSchema = z.object({
  npcId: z.string(),
});

export type NPCDeleteInput = z.infer<typeof npcDeleteSchema>;

// Player Award XP
export const playerAwardXpSchema = z.object({
  playerId: z.string(),
  amount: z.number().int(),
});

export type PlayerAwardXpInput = z.infer<typeof playerAwardXpSchema>;

// Player Level Up
export const playerLevelUpSchema = z.object({
  playerId: z.string(),
});

export type PlayerLevelUpInput = z.infer<typeof playerLevelUpSchema>;
