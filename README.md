# 🐉 DnD AI: The Dungeon Master
### AI-Powered Adaptive Dungeon Master · 5 Languages · Zero Setup Required

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![LLM Agnostic](https://img.shields.io/badge/LLM-Any%20OpenAI%20Compatible-orange.svg)](README.md)

> 🎲 **An AI Dungeon Master that remembers your story, adapts to your choices, and speaks your language.**
> 🎲 **一个能记住你的故事、适应你的选择、并用你的语言叙事的 AI 地下城主。**

---

## ✨ Why This Project? · 为什么选择这个项目？

| Feature | What It Means | 这意味着 |
|---------|---------------|----------|
| 🧠 **Long-Term Memory** | DM remembers key events, NPCs, and plot threads across dozens of turns | DM 能记住关键事件、NPC 和剧情线索，即使跨越数十个回合 |
| 🌍 **5-Language i18n** | Full localization for UI and DM narratives — EN, 中文, 日本語, Español, 한국어 | UI 和 DM 叙事完全本地化 — 英语、中文、日语、西班牙语、韩语 |
| 🎨 **Parchment & Ink Theme** | Immersive medieval campaign journal aesthetic with candle flicker and embossed UI | 沉浸式中世纪冒险日志美学，烛光摇曳，浮雕 UI |
| ⚡ **~44% Token Savings** | Smart context management with story summaries and world state blocks | 智能上下文管理，故事摘要 + 世界状态块，大幅节省 token |
| 🔌 **Any LLM Provider** | OpenAI, Ollama, LM Studio, vLLM — any OpenAI-compatible endpoint | 支持任何 OpenAI 兼容端点，本地或云端皆可 |
| 🎮 **Real-Time Multiplayer** | WebSocket sync with exponential backoff — play with friends, each in their own language | WebSocket 实时同步，和朋友一起玩，每人可用自己的语言 |

---

## 🎬 Experience Preview · 体验预览

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

## 🚀 Quick Start · 快速开始

```bash
# 1. Clone & install
git clone https://github.com/zen9527/DnD-AI-The-Dungeon-Master.git
cd DnD-AI-The-Dungeon-Master
npm install

# 2. Configure your LLM (copy .env.example → .env, then edit)
#    Supports: OpenAI, Ollama, LM Studio, vLLM, or any OpenAI-compatible endpoint

# 3. Run
npm run dev          # Development mode (hot reload)
npm start            # Production mode
```

**Windows users:** Double-click `start.bat` to build and launch. `stop.bat` to quit.
**Windows 用户：** 双击 `start.bat` 启动，双击 `stop.bat` 停止。

Open `http://localhost:3000` → Select language → Create game → Adventure begins! 🐉

---

## 🧠 DM Memory Architecture · DM 记忆架构

The DM doesn't just react — it **remembers**. Here's how:

```
┌─────────────────────────────────────────────────────────┐
│  LLM Context Window (optimized to ~4600 tokens/turn)    │
├─────────────────────────────────────────────────────────┤
│  📜 System Prompt       ~3000 tokens  (rules, mechanics)│
│  📖 Story Summary        ~200 tokens  (key events so far)│
│  🌍 World State          ~100 tokens  (HP, NPCs, combat) │
│  💬 Recent History      ~1200 tokens  (last 4 turns)     │
│  ⚔️ Current Action        ~100 tokens  (player's input)  │
└─────────────────────────────────────────────────────────┘
```

| Component | Purpose | 作用 |
|-----------|---------|------|
| **Story Summary** | Updated every 5 turns by LLM — condenses locations visited, NPCs met, major decisions | 每 5 回合自动更新，LLM 总结已访问地点、遇到的 NPC、重大决定 |
| **World State** | Compact block with player HP/AC, NPCs present, combat status | 紧凑的状态块：玩家 HP/AC、在场 NPC、战斗状态 |
| **Recent History** | Last 4 turns of conversation — short-term context | 最近 4 回合对话 — 短期上下文 |

**Result:** ~44% fewer tokens per turn vs. naive history approach. DM retains long-term memory without wasting context on repeated stats.
**效果：** 相比朴素的历史记录方式，每轮节省 ~44% token。DM 保持长期记忆，同时避免重复发送属性。

---

## 🌍 5-Language Support · 五语言支持

Every string, every DM narrative, every button — fully localized:

| Language | Locale | 语言 |
|----------|--------|------|
| 🇺🇸 English | `en-US` | 英语 |
| 🇨🇳 简体中文 | `zh-CN` | 简体中文 |
| 🇯🇵 日本語 | `ja-JP` | 日语 |
| 🇪🇸 Español | `es-ES` | 西班牙语 |
| 🇰🇷 한국어 | `ko-KR` | 韩语 |

- **UI localization:** Every button, label, tooltip, notification
- **DM narrative language:** Matches player's locale — mixed-language multiplayer sessions supported
- **Character names:** Auto-generated per locale with race-appropriate naming conventions
- **Mid-game switching:** Change language anytime — DM adapts instantly via WebSocket

---

## 🎭 Scenario-Based Storytelling · 场景化叙事

Six distinct narrative voices, each with unique sensory profiles:

| Scenario | Tone | 场景 | 风格 |
|----------|------|------|------|
| 🏰 **Dungeon** | Claustrophobic, ancient | 地下城 | 幽闭压抑，古老神秘 |
| 🌲 **Wilderness** | Expansive, alive | 荒野 | 辽阔生机勃勃 |
| 🎭 **Intrigue** | Dialogue-driven, layered | 阴谋 | 对话驱动，层层递进 |
| 👻 **Horror** | Eerie, uncertain | 恐怖 | 诡异不安 |
| ⚔️ **Epic** | Grand, sweeping | 史诗 | 宏大壮阔 |
| 🌊 **Sea** | Rhythmic, vast | 海洋 | 节奏感强，辽阔无垠 |

---

## 🛠 Tech Stack · 技术栈

**Backend · 后端**
- Node.js + TypeScript + Express
- WebSocket (`ws`) for real-time multiplayer with exponential backoff
- Universal LLM API client — any OpenAI-compatible endpoint

**Frontend · 前端**
- Vanilla TypeScript + Vite (zero framework overhead)
- Custom CSS — parchment & ink theme, responsive design
- Lightweight i18n runtime (~60 lines, zero dependencies)

**Validation & Types · 验证与类型**
- **Zod schemas** shared between backend and frontend — no duplicated validation
- Strict type safety from API to UI

**AI Integration · AI 集成**
- Streaming response with idle timeout protection (90s)
- Modular prompt engineering with scenario-specific tone injection
- Smart context management — story summaries + world state + history

---

## 📦 Project Structure · 项目结构

```
src/                    # Backend TypeScript
├── server.ts           # Express + WebSocket server
├── game/               # D&D engine
│   ├── dice.ts         # Dice rolling
│   ├── rules.ts        # 5e rules validation
│   ├── engine.ts       # Game orchestration + DM memory
│   └── store.ts        # In-memory state management
├── llm/                # AI Dungeon Master
│   ├── client.ts       # LLM API client with streaming
│   ├── prompts.ts      # Modular prompt builders
│   └── parser.ts       # JSON extraction from responses
├── types/              # Core D&D types
├── utils/              # Locale loader, ID generation
└── websocket/          # Connection management + backoff

shared/                 # Shared Zod schemas (backend + frontend)
locales/                # Translation files (5 languages)
public/                 # Frontend (TypeScript + CSS + HTML)
tests/                  # Vitest unit tests
```

---

## 🎮 Feature Highlights · 功能亮点

### 🎲 Full D&D 5e Mechanics
- **8 Classes** × **8 Races** with unique abilities and racial traits
- **Auto-generate** optimal starting stats and character names
- **Combat system** with initiative, HP tracking, and turn order
- **Death saves** — 3 successes = stable, 3 failures = death
- **Short rest** — heal with hit dice, recover spell slots
- **Potion of Healing** — dynamic inventory buttons in action bar

### 🎨 Immersive UI
- **Parchment & Ink theme** with Google Fonts (Cinzel, MedievalSharp)
- Candle flicker animation, SVG noise texture, vignette effect
- Embossed buttons, HP gloss, ink splatter decorations
- Streaming narrative with typing animation cursor

### 🔌 Multiplayer
- Real-time sync via WebSocket with exponential backoff reconnection
- Dedicated AI DM card + player character cards
- Active games list with join buttons
- One-click copy link to invite friends

---

## ⚙️ Configuration API · 配置 API

```bash
# Get current config
GET  /api/config

# Update LLM settings
POST /api/config
{ "llmBaseUrl": "http://localhost:11434/v1", "llmApiKey": "", "llmModel": "llama3.1:8b" }

# Fetch available models
GET  /api/config/models?url=http://localhost:11434/v1&key=your-key

# Test connection
POST /api/config/test
{ "llmBaseUrl": "http://localhost:11434/v1", "llmApiKey": "", "llmModel": "" }

# List active games
GET  /api/games

# List saved games
GET  /api/saved-games

# Delete saved game
DELETE /api/saved-games/:id
```

---

## 🤝 Contributing · 贡献指南

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m "feat: add amazing feature"`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

**Development commands:**
```bash
npm run build        # Full build (backend + frontend)
npm run dev          # Concurrent watch mode
npm test             # Run Vitest tests
npx tsc --noEmit     # Type check without compilation
```

---

## 📄 License · 许可证

**MIT** — Built for solo D&D enthusiasts and AI-powered tabletop experimentation.

---

<div align="center">

**Built by Flex** · Powered by TypeScript, WebSocket, and the magic of LLMs ✨

[⭐ Star this repo](https://github.com/zen9527/DnD-AI-The-Dungeon-Master) · [🐛 Report Bug](https://github.com/zen9527/DnD-AI-The-Dungeon-Master/issues) · [💡 Request Feature](https://github.com/zen9527/DnD-AI-The-Dungeon-Master/issues)

</div>
