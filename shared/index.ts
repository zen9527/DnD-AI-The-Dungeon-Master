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
export { npcSchema, eventSchema, diceRollSchema } from "./schemas/game.js";

export type {
  CreateGameInput,
  JoinGameInput,
  CharacterInput,
} from "./schemas/game.js";

export type { PlayerActionInput } from "./schemas/action.js";
export type { PlayerActionInput as ActionInput } from "./schemas/action.js";
export type { ChatMessageInput } from "./schemas/chat.js";
export type { NPCInput, EventInput, DiceRollInput } from "./schemas/game.js";

export { scenarioOptions, scenarioDescriptions } from "./schemas/scenario.js";
export type { Scenario } from "./schemas/scenario.js";

export { configSchema, endpointPresets } from "./schemas/config.js";
export type { ConfigInput } from "./schemas/config.js";
export type { EndpointPreset } from "./schemas/config.js";
