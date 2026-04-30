# 🎲 DnD Multiplayer — LLM-Powered Adaptive Dungeon Master

A next-generation tabletop RPG experience where **AI acts as your adaptive Dungeon Master**, delivering dynamic storytelling that responds to player choices in real-time. Built with WebSocket-powered multiplayer support and sophisticated LLM-driven narrative generation.

## ✨ Key Features

### 🤖 AI-Driven Dungeon Master
- **Adaptive Narrative Engine**: The DM dynamically adjusts tone, pacing, and sensory details based on the scenario (dungeon, wilderness, horror, epic, sea, intrigue)
- **Show Don't Tell**: AI generates rich, concrete descriptions with layered sensory details instead of abstract states
- **Visual Immersion**: Contextual emojis (⚔️🐉🕯️), scene dividers (═══ ✦ ═══), and status indicators make every response vivid and atmospheric
- **Player Agency Preservation**: Never narrates player actions — only describes the world and NPC reactions
- **Structured Output**: Every response includes parsed JSON for game state management (combat tracking, NPC status, environmental changes)

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

### 🔌 Multiplayer WebSocket Architecture
- Real-time synchronized gameplay across multiple players
- Dedicated AI DM card + player character cards with full details
- Live chat system with role-based message labeling (DM vs. Player)

## 🛠 Tech Stack

**Backend**
- Node.js + TypeScript + Express
- WebSocket (`ws`) for real-time multiplayer sync
- Config management with `.env` support

**Frontend**
- TypeScript + Vite
- React-style component architecture
- Custom CSS with parchment & ink theme

**Validation & Types**
- **Zod schemas** shared between backend and frontend (no duplicated validation)
- Strict type safety from database to UI components

**AI Integration**
- Universal LLM API client supporting any OpenAI-compatible endpoint
- Streaming response handling with idle timeout protection
- Modular prompt engineering with scenario-specific tone injection

## 📦 Project Structure

```
src/                    # Backend TypeScript source
├── server.ts           # Express + WebSocket server
├── game/               # D&D engine modules
│   ├── dice.ts         # Dice rolling logic
│   ├── rules.ts        # 5e rules validation
│   ├── engine.ts       # Game orchestration
│   └── store.ts        # State management
├── llm/                # AI Dungeon Master
│   ├── client.ts       # LLM API client with streaming
│   ├── prompts.ts      # Scenario-specific prompt builders
│   └── parser.ts       # JSON extraction from responses
├── types/              # Core D&D type definitions
├── utils/              # Configuration, URL normalization
└── websocket/          # WebSocket connection management

shared/                 # Zod schemas (backend + frontend)
├── config.ts           # LLM configuration schema
├── scenario.ts         # Scenario definitions & tones
├── game.ts             # Game state validation
├── chat.ts             # Chat message structure
└── action.ts           # Player/NPC actions

public/                 # Frontend (TypeScript + CSS + HTML)
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
```

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

// Used identically in backend API and frontend forms
```

### Streaming LLM Integration
- Idle timeout protection (90s default) to handle disconnected streams
- Chunk-by-chunk processing with callback-based UI updates
- Graceful error handling with structured error reporting

### Modular Prompt Engineering
The AI DM prompt is constructed from independent, swappable modules:
1. **Core Identity** — DM role, adaptive tone directive
2. **Scenario Tone** — Scenario-specific sensory/pacing rules
3. **Narrative Style** — Show-don't-tell, vocabulary constraints
4. **Dialogue Rules** — NPC speech formatting
5. **Active Level Logic** — Reactive vs. proactive triggers
6. **Structured Output Schema** — JSON parsing requirements

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

1. Player selects scenario (e.g., "Dungeon")
2. System generates prompt with dungeon-specific tone and sensory rules
3. AI DM describes initial scene with layered sensory details
4. Player takes action via UI or chat
5. Game engine validates action against 5e rules
6. Dice rolled (if needed), result returned to LLM
7. AI responds with narrative + structured JSON updates
8. Frontend parses JSON, updates game state UI

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

- **Character Cards**: Display race, class, HP, and character details
- **AI DM Card**: Dedicated interface for Dungeon Master communications
- **Settings Panel**: Runtime configuration with live validation
- **Theme System**: Parchment & Ink aesthetic with responsive design
- **Event Delegation**: Efficient DOM event handling across dynamic UI

## 📄 License

MIT — Built for solo D&D enthusiasts and AI-powered tabletop experimentation.

---

**Built by Flex** | Powered by TypeScript, WebSocket, and the magic of LLMs ✨
