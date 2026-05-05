export type {
  Player,
  Item,
  NPC,
  ChatMessage,
  DiceRoll,
  DiceRollResult,
  StructuredResult,
  StreamResult,
  Game,
  Event,
  MessageType,
  WebSocketMessage,
  CreateGamePayload,
  JoinGamePayload,
  PlayerActionPayload,
  ChatMessagePayload,
  DiceRollPayload,
  ErrorMessage,
  Attributes,
  DiceType,
  NPCCreatePayload,
  EventCreatePayload,
} from "../src/types/index.js";

export {
  createGameSchema,
  joinGameSchema,
  createCharacterSchema,
  raceOptions,
  classOptions,
} from "./schemas/game.js";

export { playerActionSchema } from "./schemas/action.js";
export { chatMessageSchema } from "./schemas/chat.js";
export { emoteSchema } from "./schemas/emote.js";
export { privateChatSchema } from "./schemas/private-chat.js";
export { npcSchema, eventSchema, diceRollSchema, saveGameSchema } from "./schemas/game.js";

export type {
  CreateGameInput,
  JoinGameInput,
  CharacterInput,
} from "./schemas/game.js";

export type { PlayerActionInput } from "./schemas/action.js";
export type { PlayerActionInput as ActionInput } from "./schemas/action.js";
export type { ChatMessageInput } from "./schemas/chat.js";
export type { EmoteInput } from "./schemas/emote.js";
export type { PrivateChatInput } from "./schemas/private-chat.js";
export type { NPCInput, EventInput, DiceRollInput, SaveGameInput } from "./schemas/game.js";

export { scenarioOptions, scenarioDescriptions } from "./schemas/scenario.js";
export type { Scenario } from "./schemas/scenario.js";

export { configSchema, endpointPresets } from "./schemas/config.js";
export type { ConfigInput } from "./schemas/config.js";
export type { EndpointPreset } from "./schemas/config.js";

export { SUPPORTED_LOCALES, LOCALE_DISPLAY, LOCALE_NATIVE, localeSchema } from "./schemas/locale.js";
export type { SupportedLocale } from "./schemas/locale.js";

// Combat schemas
export {
  combatStartSchema,
  combatEndSchema,
  initiativeRollSchema,
  turnAdvanceSchema,
  combatStateSchema,
} from "./schemas/combat.js";
export type {
  CombatStartInput,
  CombatEndInput,
  InitiativeRollInput,
  TurnAdvanceInput,
  CombatStateOutput,
} from "./schemas/combat.js";

// Combat types
export type { InitiativeEntry } from "../src/types/index.js";

// DM Control schemas
export {
  npcUpdateHpSchema,
  npcApplyConditionSchema,
  npcRemoveConditionSchema,
  npcCreateEnhancedSchema,
  npcDeleteSchema,
  playerAwardXpSchema,
  playerLevelUpSchema,
  playerResetXpSchema,
  conditionOptions,
} from "./schemas/dm-control.js";
export type {
  NPCUpdateHpInput,
  NPCApplyConditionInput,
  NPCRemoveConditionInput,
  NPCCreateEnhancedInput,
  NPCDeleteInput,
  PlayerAwardXpInput,
  PlayerLevelUpInput,
  PlayerResetXpInput,
  NPCListOutput,
  PlayerListOutput,
} from "./schemas/dm-control.js";
