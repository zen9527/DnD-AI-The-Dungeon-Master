# 🎲 DnD AI: The Dungeon Master — AI-Powered Adaptive Dungeon Master

A next-generation tabletop RPG experience where **AI acts as your adaptive Dungeon Master**, delivering dynamic storytelling that responds to player choices in real-time. Built with WebSocket-powered multiplayer support and sophisticated LLM-driven narrative generation. Supports 5 languages (English, Chinese Simplified, Japanese, Spanish, Korean) for both UI and DM narratives.

## ✨ Key Features

### 🤖 AI-Driven Dungeon Master
- **Adaptive Narrative Engine**: The DM dynamically adjusts tone, pacing, and sensory details based on the scenario (dungeon, wilderness, horror, epic, sea, intrigue)
- **Show Don't Tell**: AI generates rich, concrete descriptions with layered sensory details instead of abstract states
- **Visual Immersion**: Contextual emojis (⚔️🐉🕯️), scene dividers (═══ ✦ ═══), and status indicators make every response vivid and atmospheric
- **Player Agency Preservation**: Never narrates player actions — only describes the world and NPC reactions
- **Structured Output**: Every response includes parsed JSON for game state management (combat tracking, NPC status, environmental changes)

### 🌍 5-Language i18n Support
Full localization across all interfaces and DM narratives:
- **English**, **简体中文** (Chinese Simplified), **日本語** (Japanese), **Español** (Spanish), **한국어** (Korean)
- UI strings fully translated — every button, label, notification, tooltip
- DM narrative language matches each player's locale — multiplayer sessions can have mixed-language narratives
- Character names auto-generated per locale with race-appropriate naming conventions
- Race/class descriptions displayed during character creation in selected language

### 🎭 Scenario-Based Storytelling
Six distinct narrative voices with unique sensory profiles:

| Scenario | Tone | Sensory Focus |
|----------|------|---------------|
| **Dungeon** | Claustrophobic, ancient | Touch (cold stone), sound (dripping water), shadows |
| **Wilderness** | Expansive, alive | Wind, pine resin, horizon mysteries |
| **Intrigue** | Dialogue-driven, layered | Whispers, deliberate gestures, masked agendas |
| **Horror** | Eerie, uncertain | Wet dragging sounds, impossible shadows |
| **Epic** | Grand, sweeping | Dragon silhouettes, war horns, ancient prophecies |
| **Sea** | Rhythmic, vast | Salt crusts, creaking timber, storm rhythms |

### 🎲 Integrated Dice & Rules Engine
- Full D&D 5e rules implementation with automated dice rolling
- Combat tracking with initiative, HP management, and turn order
- Real-time validation of game actions against rule constraints
- **Death Save Tracking**: Track successes/failures at 0 HP — 3 failures = death, 3 successes = stable
- **Short Rest Mechanics**: Roll hit dice for healing, recover spell slots & hit dice, reset death saves when HP > 0
- **Potion Usage**: Dynamic potion buttons in action bar; drinking a Potion of Healing rolls hit dice and updates HP

### 🎭 Character Creation System
- **12 Classes** with unique abilities: Fighter, Wizard, Rogue, Cleric, Barbarian, Paladin, Ranger, Sorcerer, Artificer, Monk, Bard, Warlock
- **8 Races** with racial traits: Human (+1 all), Elf (darkvision + Fey Ancestry), Dwarf (constitution bonus), Halfling (luck reroll), Dragonborn (breath weapon), Half-Elf (Fey Ancestry + skills), Gnome (magic resistance), Half-Orc (relentless endurance)
- **Auto-Generate Attributes & Name**: Click button to auto-fill optimal starting stats based on class/race combination, plus race-appropriate character name generation per locale
- **Race/Class Descriptions**: Real-time ability descriptions displayed when selecting race or class

### 🎮 Action Bar
- Preset action buttons: ⚔️ Attack, 🔍 Search, 💬 Talk, 🏃 Hide, 🧠 Use Intelligence, 🛡️ Defend
- **Spell Casting Dropdown**: Organized by spell level groups — select a spell to cast it via the DM
- **Potion Buttons**: Dynamic inventory items appear based on character's potions
- Action text stays English for LLM understanding; labels localize per player language

### 🔌 Multiplayer WebSocket Architecture
- Real-time synchronized gameplay across multiple players with **exponential backoff reconnection** (5 attempts, doubling delay)
- Dedicated AI DM card + player character cards with full details
- Live chat system with role-based message labeling (DM vs. Player)
- Active Games List: Fetchable via `/api/games` or UI cards with join buttons; auto-refreshes every 30 seconds
- **Copy Link Button**: One-click share game URL for easy joining
- Conversation history truncated to last 20 messages to manage context window

## 🛠 Tech Stack

**Backend**
- Node.js + TypeScript + Express
- WebSocket (`ws`) for real-time multiplayer sync with exponential backoff reconnection
- Config management with `.env` support; REST API endpoints for runtime configuration

**Frontend**
- Vanilla TypeScript + Vite (no React — custom component classes with event delegation)
- Custom CSS with parchment & ink theme, responsive design
- Lightweight i18n runtime (~60 lines, zero dependencies) with locale persistence via localStorage

**Validation & Types**
- **Zod schemas** shared between backend and frontend (no duplicated validation)
- Strict type safety from database to UI components

**AI Integration**
- Universal LLM API client supporting any OpenAI-compatible endpoint
- Streaming response handling with idle timeout protection (90s default)
- Modular prompt engineering with scenario-specific tone injection + per-player language directives
- Context window management via conversation history truncation

## 📦 Project Structure

```
src/                    # Backend TypeScript source
├── server.ts           # Express + WebSocket server
├── game/               # D&D engine modules
│   ├── dice.ts         # Dice rolling logic
│   ├── rules.ts        # 5e rules validation (skills, saves, DCs)
│   ├── engine.ts       # Game orchestration (actions, rests, spells)
│   └── store.ts        # State management in-memory
├── llm/                # AI Dungeon Master
│   ├── client.ts       # LLM API client with streaming
│   ├── prompts.ts      # Scenario-specific prompt builders + language directives
│   └── parser.ts       # JSON extraction from responses
├── types/              # Core D&D type definitions (Player, NPC, Game)
├── utils/              # ID generation, URL normalization, locale loader
└── websocket/          # WebSocket connection management with backoff

shared/                 # Zod schemas (backend + frontend)
├── config.ts           # LLM configuration schema + endpoint presets
├── scenario.ts         # Scenario definitions & tones
├── game.ts             # Game state validation
├── chat.ts             # Chat message structure
├── action.ts           # Player/NPC actions
└── locale.ts           # Supported locales enum + display names

locales/                # Translation files (5 languages)
├── en.json             # English — UI strings, race/class data, scenarios
├── zh-CN.json          # Chinese Simplified
├── ja-JP.json          # Japanese
├── es-ES.json          # Spanish
└── ko-KR.json          # Korean

public/                 # Frontend (TypeScript + CSS + HTML)
├── js/                 # Vanilla TS modules: app, character, action-bar, i18n, websocket, game-state
├── css/                # Parchment & ink theme styles
└── index.html          # SPA entry point

tests/                  # Vitest unit tests (prompt engineering validation)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (for native `fetch` support)
- An LLM API endpoint (OpenAI, local model, or any OpenAI-compatible server)

### Installation

```bash
# Install dependencies
npm install

# Configure your LLM connection
cp .env.example .env
# Edit .env with:
# - LLM_API_URL (e.g., http://localhost:11434/v1 for Ollama, https://api.openai.com/v1)
# - LLM_API_KEY (if required by your provider)
# - LLM_MODEL (e.g., "gpt-4", "llama3.1:8b")

# Development mode (concurrent backend + frontend watch)
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test

# Type check without compilation
npx tsc --noEmit
```

## 🎮 Quick Start

### Windows (Double-Click)
1. Double-click **`start.bat`** — builds and launches the server automatically
2. Open `http://localhost:3000` in your browser
3. To stop: double-click **`stop.bat`** or press `Ctrl+C` in terminal

### Usage Flow
1. **Select Language**: Use the locale dropdown (top-right corner) to choose UI language; page reloads with translations
2. **Create Game** — Select a scenario, create your character (auto-generate stats + name), begin adventure
3. **Join Game** — Share the link via copy-link button; other players join with their own characters and language preference
4. **Take Actions** — Use preset buttons (⚔️ Attack, 🔍 Search, 💬 Talk) or type freely in chat
5. **Cast Spells** — Select from spell dropdown organized by level groups
6. **Use Potions** — Click potion buttons in action bar to heal with hit dice rolls
7. **Take Short Rest** — Type "short rest" to recover HP via hit dice and restore spell slots
8. **Configure LLM** — Click ⚙️ on the welcome screen or game header to set your AI provider, fetch models, test connection

---

### Configuration API

The server exposes a REST API for runtime configuration:

```typescript
// Get current config
GET /api/config

// Update LLM settings (requires restart)
POST /api/config
{
  "llmBaseUrl": "http://localhost:11434/v1",
  "llmApiKey": "your-api-key",
  "llmModel": "llama3.1:8b"
}

// Fetch available models from LLM endpoint
GET /api/config/models?url=http://localhost:11434/v1&key=your-key

// Test connection to LLM endpoint
POST /api/config/test
{
  "llmBaseUrl": "http://localhost:11434/v1",
  "llmApiKey": "",
  "llmModel": ""
}

// List active games (for join UI)
GET /api/games
```

## 🎯 Architecture Highlights

### Shared Validation Schemas
```typescript
// shared/schemas/config.ts
import { z } from "zod";
export const configSchema = z.object({
  llmBaseUrl: z.string().url(),
  llmApiKey: z.string().optional(),
  llmModel: z.string().min(1),
});

// Used identically in backend API and frontend forms — zero duplication
```

### Streaming LLM Integration
- Idle timeout protection (90s default) to handle disconnected streams
- Chunk-by-chunk processing with callback-based UI updates
- Graceful error handling with structured error reporting + fallback narrative on failure
- Backend locale-aware event messages (initiative rolls, potion healing, short rest)

### Modular Prompt Engineering
The AI DM prompt is constructed from independent, swappable modules:
1. **Core Identity** — DM role, adaptive tone directive
2. **Scenario Tone** — Scenario-specific sensory/pacing rules
3. **Narrative Style** — Show-don't-tell, vocabulary constraints
4. **Dialogue Rules** — NPC speech formatting
5. **Active Level Logic** — Reactive vs. proactive triggers
6. **Structured Output Schema** — JSON parsing requirements
7. **Language Directive** — Per-player locale injection (`Respond in [language]`)

### 🎨 DM Response Style

The AI DM enriches every response with visual elements:

```
🏰 The heavy oak door creaks open, revealing a cavernous hall lit by
   flickering torchlight. The air tastes of old smoke and damp earth. 🕯️

═══ ✦ ═══

A goblin merchant lurks behind a makeshift stall, his yellowed teeth bared
in a grin that doesn't reach his eyes. His hand rests near a dagger beneath
the counter. 👁️🗨️

"Ah... travelers," he croaks, voice like grinding stones. "What brings you
to my humble establishment?"
```

---

## 📝 Example Gameplay Flow

1. Player selects scenario (e.g., "Dungeon") and language preference
2. System generates prompt with dungeon-specific tone + language directive
3. AI DM describes initial scene with layered sensory details in player's locale
4. Player creates character — auto-generate attributes and name based on class/race
5. Player takes action via UI buttons or free-form chat input
6. Game engine validates action against 5e rules (skills, saves, DCs)
7. Dice rolled (if needed), result returned to LLM with context window management
8. AI responds with narrative + structured JSON updates (HP changes, new NPCs, spells learned)
9. Frontend parses JSON, updates game state UI — HP bars, player cards, chat messages
10. Other players see real-time updates via WebSocket streaming

## 🌐 Supported LLM Providers

Any OpenAI-compatible API endpoint:
- **OpenAI** — GPT-4, GPT-3.5-Turbo
- **Ollama** — Local models (Llama, Mistral, etc.)
- **vLLM** — High-throughput inference servers
- **LM Studio** — Desktop local inference
- **Custom endpoints** — Any endpoint with `/chat/completions`

Configure via `LLM_API_URL`:
```bash
# OpenAI
export LLM_API_URL=https://api.openai.com/v1

# Ollama (local)
export LLM_API_URL=http://localhost:11434/v1

# LM Studio (local)
export LLM_API_URL=http://localhost:1234/v1
```

## 🎨 UI Features

- **Character Cards**: Display race, class, level, HP bar with color-coded thresholds (high/mid/low)
- **AI DM Card**: Dedicated interface for Dungeon Master communications with active status indicator
- **Settings Panel**: Runtime configuration modal with preset selection (LM Studio/Ollama/OpenAI/etc.), model fetching dropdown, test connection button
- **Theme System**: Parchment & Ink aesthetic with responsive design, auto-generated character name visual feedback
- **Event Delegation**: Single `document.body` click handler survives all DOM swaps — no listener leaks
- **Active Games List**: Fetchable via `/api/games`, cards show scenario icons + localized labels, join buttons disabled when full
- **Copy Link Button**: One-click share game URL to clipboard with notification toast
- **Streaming Narrative Display**: Typing animation cursor during LLM response streaming

## 📄 License

MIT — Built for solo D&D enthusiasts and AI-powered tabletop experimentation.

---

**Built by Flex** | Powered by TypeScript, WebSocket, and the magic of LLMs ✨
