// ============================================================================
// Shared Exports — Zod schemas and types used by both backend and frontend
// ============================================================================

// Core types (from backend types, re-exported for convenience)
export type {
  Player,
  Item,
  NPC,
  ChatMessage,
  DiceRoll,
  StructuredResult,
  StreamResult,
  Game,
  Event,
  MessageType,
  WebSocketMessage,
  Attributes,
} from "../src/types/index.js";

// Combat types
export type { InitiativeEntry } from "../src/types/index.js";

// Game schemas
export {
  createGameSchema,
  joinGameSchema,
  createCharacterSchema,
  raceOptions,
  classOptions,
  npcSchema,
  eventSchema,
  diceRollSchema,
  saveGameSchema,
  itemSchema,
  equipItemSchema,
  useItemSchema,
  HIT_DIE_BY_CLASS,
  XP_THRESHOLDS,
  SPELL_ABILITY_MAP,
} from "./schemas/game.js";

export type {
  CreateGameInput,
  JoinGameInput,
  CharacterInput,
  NPCInput,
  EventInput,
  DiceRollInput,
  SaveGameInput,
} from "./schemas/game.js";

// Action & Chat schemas
export { playerActionSchema } from "./schemas/action.js";
export { chatMessageSchema } from "./schemas/chat.js";
export type { PlayerActionInput } from "./schemas/action.js";
export type { ChatMessageInput } from "./schemas/chat.js";
export type { ChatMessageInput as MessageInput } from "./schemas/chat.js";

// Emote & Private Chat schemas
export { emoteSchema } from "./schemas/emote.js";
export { privateChatSchema } from "./schemas/private-chat.js";
export type { EmoteInput } from "./schemas/emote.js";
export type { PrivateChatInput } from "./schemas/private-chat.js";

// Scenario
export { scenarioOptions, scenarioDescriptions } from "./schemas/scenario.js";
export type { Scenario } from "./schemas/scenario.js";

// Config
export { configSchema, endpointPresets } from "./schemas/config.js";
export type { ConfigInput } from "./schemas/config.js";
export type { EndpointPreset } from "./schemas/config.js";

// Locale
export { SUPPORTED_LOCALES, LOCALE_DISPLAY, LOCALE_NATIVE, localeSchema } from "./schemas/locale.js";
export type { SupportedLocale } from "./schemas/locale.js";

// Combat schemas
export {
  combatStartSchema,
  initiativeRollSchema,
} from "./schemas/combat.js";
export type {
  CombatStartInput,
  InitiativeRollInput,
} from "./schemas/combat.js";

// DM Control schemas
export {
  npcUpdateHpSchema,
  npcApplyConditionSchema,
  npcRemoveConditionSchema,
  npcDeleteSchema,
  playerAwardXpSchema,
  playerLevelUpSchema,
  conditionOptions,
} from "./schemas/dm-control.js";
export type {
  NPCUpdateHpInput,
  NPCApplyConditionInput,
  NPCRemoveConditionInput,
  NPCDeleteInput,
  PlayerAwardXpInput,
  PlayerLevelUpInput,
} from "./schemas/dm-control.js";

// Buff schemas
export { applyTemporaryHpSchema, applyBuffSchema, removeBuffSchema } from "./schemas/buff.js";
export type { ApplyTemporaryHpInput, ApplyBuffInput, RemoveBuffInput } from "./schemas/buff.js";
