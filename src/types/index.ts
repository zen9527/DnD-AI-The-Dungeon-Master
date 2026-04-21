export type Attributes = { str: number; dex: number; con: number; int: number; wis: number; cha: number };

export interface Player {
  id: string;
  name: string;
  characterName: string;
  isDM: boolean;
  race: string;
  characterClass: string;
  level: number;
  attributes: Attributes;
  hp: number;
  maxHp: number;
  ac: number;
  proficiencyBonus: number;
  spellSlots: Record<string, number>;
  inventory: Item[];
  conditions: string[];
}

export type DiceType = 4 | 6 | 8 | 10 | 12 | 20;

export interface Item {
  name: string;
  type: 'weapon' | 'armor' | 'potion' | 'misc';
  description: string;
  weight: number;
  attackBonus?: number;
  damageDice?: { type: DiceType; count: number };
}

export interface NPC {
  id: string;
  name: string;
  description: string;
  role: 'friendly' | 'neutral' | 'hostile';
  hp: number;
  maxHp: number;
  ac: number;
  attributes: Attributes;
  initiative?: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  playerId?: string;
  playerName?: string;
  characterName?: string;
  content: string;
  type: 'text' | 'roll' | 'npc' | 'event' | 'narrative';
  timestamp: number;
}

export interface DiceRoll {
  id: string;
  playerId: string;
  playerName: string;
  characterName: string;
  diceType: number;
  count: number;
  rolls: number[];
  modifier: number;
  total: number;
  isHit: boolean;
  timestamp: number;
}

export interface StructuredResult {
  hit: boolean;
  isCritical: boolean;
  damage?: number;
  playerHp?: { before: number; after: number };
  creatureHp?: { name: string; before: number; after: number };
  creatureDefeated?: boolean;
  newNPCs?: NPC[];
  newEvents?: { title: string; description: string }[];
  turn: {
    nextPlayerId: string;
    initiative: { playerId: string; npcId?: string; score: number }[];
    round: number;
  };
}

export interface StreamResult {
  fullNarrative: string;
  structured: StructuredResult;
}

export interface Game {
  id: string;
  name: string;
  maxPlayers: number;
  scenario: string;
  players: Player[];
  npcs: NPC[];
  chatHistory: ChatMessage[];
  events: Event[];
  conversationHistory: { role: 'system' | 'user' | 'assistant'; content: string }[];
  createdAt: number;
}

export type MessageType =
  // Client → Server
  | 'CREATE_GAME'
  | 'JOIN_GAME'
  | 'LIST_GAMES'
  | 'PLAYER_ACTION'
  | 'PLAYER_CHAT'
  | 'DICE_ROLL'
  | 'NPC_CREATE'
  | 'EVENT_CREATE'
  // Server → Client
  | 'GAME_CREATED'
  | 'GAME_STATE'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PLAYER_ACTION_RESULT'
  | 'CHAT_MESSAGE'
  | 'DICE_ROLL_RESULT'
  | 'NPC_CREATED'
  | 'EVENT_CREATED'
  | 'STREAM_CHUNK'
  | 'STREAM_END'
  | 'STREAM_ERROR'
  | 'ERROR';

export interface WebSocketMessage<T = unknown> {
  type: MessageType;
  payload: T;
}

export interface CreateGamePayload {
  gameName: string;
  maxPlayers: number;
  playerName: string;
  characterName: string;
  race: string;
  characterClass: string;
  attributes: Attributes;
}

export interface JoinGamePayload {
  gameId: string;
  playerName: string;
  characterName: string;
  race: string;
  characterClass: string;
  attributes: Attributes;
}

export interface PlayerActionPayload {
  action: string;
  dice?: { type: number; count: number; modifier?: number };
  target?: string;
}

export interface ChatMessagePayload {
  content: string;
}

export interface DiceRollPayload {
  diceType: number;
  count: number;
  modifier?: number;
}

export interface ErrorMessage {
  errorMessage: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: number;
}

export type DiceRollResult = DiceRoll;

export interface NPCCreatePayload {
  name: string;
  description?: string;
  role: 'friendly' | 'neutral' | 'hostile';
}

export interface EventCreatePayload {
  title: string;
  description?: string;
}
