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

// NPC Create (enhanced with full stats)
export const npcCreateEnhancedSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  role: z.enum(['friendly', 'neutral', 'hostile']),
  hp: z.number().int().min(0),
  maxHp: z.number().int().min(0),
  ac: z.number().int().min(0),
  attributes: z.object({
    str: z.number().int().min(1).max(20),
    dex: z.number().int().min(1).max(20),
    con: z.number().int().min(1).max(20),
    int: z.number().int().min(1).max(20),
    wis: z.number().int().min(1).max(20),
    cha: z.number().int().min(1).max(20),
  }),
});

export type NPCCreateEnhancedInput = z.infer<typeof npcCreateEnhancedSchema>;

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

// Player Reset XP
export const playerResetXpSchema = z.object({
  playerId: z.string(),
});

export type PlayerResetXpInput = z.infer<typeof playerResetXpSchema>;

// NPC List Output
export const npcListSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  role: z.enum(['friendly', 'neutral', 'hostile']),
  hp: z.number().int(),
  maxHp: z.number().int(),
  ac: z.number().int(),
  attributes: z.object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  }),
  initiative: z.number().optional(),
  conditions: z.array(z.enum(conditionOptions)),
  createdAt: z.number(),
}));

export type NPCListOutput = z.infer<typeof npcListSchema>;

// Player List Output
export const playerListSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  characterName: z.string(),
  isDM: z.boolean(),
  race: z.string(),
  characterClass: z.string(),
  level: z.number().int(),
  attributes: z.object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  }),
  hp: z.number().int(),
  maxHp: z.number().int(),
  ac: z.number().int(),
  xp: z.number().int(),
  conditions: z.array(z.string()),
}));

export type PlayerListOutput = z.infer<typeof playerListSchema>;
