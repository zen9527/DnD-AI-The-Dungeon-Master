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
  spells: Spell[]; // Learned spells with levels
  inventory: Item[]; // Potions and other consumables
  conditions: string[];

  // D&D 5e extended mechanics
  hitDice: { total: number; used: number }; // Hit dice for short rest healing
  deathSaves: { successes: number; failures: number }; // Death save tracking (3/3 = dead/stable)
  xp: number; // Experience points
  locale: string; // Preferred language for UI and DM narrative language (e.g., "en-US", "zh-CN")
  
  // Combat mechanics
  initiative?: number; // Initiative score for combat turn order
  temporaryHp?: number; // Temporary HP that absorbs damage first
  temporaryHpRemaining?: number; // Rounds remaining for temporary HP
  
  // Equipment system
  equippedWeapon?: Item; // Currently equipped weapon
  equippedArmor?: Item; // Currently equipped armor
  usedItems: string[]; // IDs of consumed items (potions, etc.)
  
  // Buff/Debuff system
  buffs: {
    name: string;
    effect: string;
    bonus?: number; // Numeric bonus (e.g., +2 to attacks)
    duration: number; // Rounds remaining
  }[];
}

export type DiceType = 4 | 6 | 8 | 10 | 12 | 20;

export interface Spell {
  name: string;
  level: number; // 1-9 as per D&D rules
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'misc';
  description?: string;
  weight: number;
  stats?: {
    attackBonus?: number;
    damageDice?: { type: DiceType; count: number };
    armorClassBonus?: number;
    healingAmount?: number;
  };
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
  
  // Combat mechanics
  temporaryHp?: number; // Temporary HP that absorbs damage first
  temporaryHpRemaining?: number; // Rounds remaining for temporary HP
  conditions: string[]; // Combat conditions (poisoned, prone, blinded, etc.)
  
  // Buff/Debuff system
  buffs: {
    name: string;
    effect: string;
    bonus?: number; // Numeric bonus (e.g., +2 to attacks)
    duration: number; // Rounds remaining
  }[];
}

export interface ChatMessage {
  id: string;
  playerId?: string;
  playerName?: string;
  characterName?: string;
  content: string;
  type: 'text' | 'roll' | 'npc' | 'event' | 'narrative' | 'emote'; // Added 'emote' type
  timestamp: number;
  diceResult?: DiceRoll; // Auto-rolled dice result for skill checks
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
  skillCheck?: {
    skill: string;
    dc: number;
    success: boolean;
  };
}

export interface InitiativeEntry {
  playerId?: string;
  npcId?: string;
  score: number;
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  isPlayer: boolean;
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
  newSpells?: Spell[]; // Spells learned during gameplay
  diceResult?: DiceRoll; // Auto-rolled skill check result
  turn: {
    nextPlayerId: string;
    initiative: InitiativeEntry[];
    round: number;
    currentTurnIndex: number;
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
  
  // Combat state
  combatMode: boolean; // True when combat is active
  initiativeOrder: InitiativeEntry[]; // Current turn order
  currentRound: number; // Current combat round number
  currentTurnIndex: number; // Index in initiative order
}

export type MessageType =
  // Client → Server
  | 'CREATE_GAME'
  | 'JOIN_GAME'
  | 'LIST_GAMES'
  | 'PLAYER_ACTION'
  | 'CHAT_MESSAGE'        // Chat message from player
  | 'PLAYER_EMOTE'        // Emote command support
  | 'PRIVATE_CHAT'        // Private messaging
  | 'SET_LOCALE'
  | 'DICE_ROLL'
  | 'NPC_CREATE'
  | 'EVENT_CREATE'
  | 'COMBAT_START'        // NEW: Start combat mode
  | 'COMBAT_END'          // NEW: End combat mode
  | 'INITIATIVE_ROLL'     // NEW: Roll individual initiative
  | 'TURN_ADVANCE'        // NEW: Manually advance turn
  | 'NPC_UPDATE_HP'       // NEW: DM update NPC HP
  | 'NPC_APPLY_CONDITION' // NEW: DM apply condition to NPC
  | 'NPC_REMOVE_CONDITION'// NEW: DM remove condition from NPC
  | 'NPC_DELETE'          // NEW: DM delete NPC
  | 'PLAYER_AWARD_XP'     // NEW: DM award XP to player
  | 'PLAYER_LEVEL_UP'     // NEW: DM level up player
  | 'INVENTORY_ADD_ITEM'  // NEW: Add item to inventory
  | 'EQUIP_WEAPON'        // NEW: Equip weapon
  | 'EQUIP_ARMOR'         // NEW: Equip armor
  | 'UNEQUIP_WEAPON'      // NEW: Unequip weapon
  | 'UNEQUIP_ARMOR'       // NEW: Unequip armor
  | 'USE_ITEM'            // NEW: Use consumable item
  | 'APPLY_TEMPORARY_HP'  // NEW: Apply temporary HP with duration
  | 'APPLY_BUFF'          // NEW: Apply buff to entity
  | 'REMOVE_BUFF'         // NEW: Remove buff from entity
  | 'SAVE_GAME'           // NEW: Client requests game save
  // Server → Client
  | 'GAME_CONNECTED'
  | 'GAME_CREATED'
  | 'GAME_STATE'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PLAYER_ACTION_RESULT'
  | 'CHAT_MESSAGE'
  | 'EMOTE_MESSAGE'       // NEW: Emote broadcast
  | 'PRIVATE_MESSAGE'     // NEW: Private message delivery
  | 'DICE_ROLL_RESULT'
  | 'NPC_CREATED'
  | 'EVENT_CREATED'
  | 'STREAM_CHUNK'
  | 'STREAM_END'
  | 'STREAM_ERROR'
  | 'LOCALE_UPDATED'
  | 'TURN_TIMER'          // NEW: Turn timer notification
  | 'COMBAT_STATE'        // NEW: Combat mode state update
  | 'INITIATIVE_UPDATE'   // NEW: Initiative order update
  | 'DM_CONTROL_UPDATE'   // NEW: DM control action broadcast
  | 'INVENTORY_UPDATE'    // NEW: Inventory updated
  | 'EQUIPMENT_UPDATE'    // NEW: Equipment changed
  | 'ITEM_USED'           // NEW: Item consumed
  | 'BUFF_UPDATE'         // NEW: Buff/Debuff change
  | 'GAME_SAVED'          // NEW: Server confirms save success
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
  helpers?: string[]; // NEW - Player IDs helping on this check
}

export interface ChatMessagePayload {
  content: string;
}

export interface EmotePayload {
  action: string; // e.g., "waves hello", "draws sword"
}

export interface PrivateChatPayload {
  targetPlayerId: string;
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
