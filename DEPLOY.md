# DnD Full Auto-DM - Quick Start

## 🚀 Start the Server

### Windows

Double-click **`start.bat`** — it builds and starts the server automatically.

Or from command line:
```bash
npm start
```

### Stop the Server

Double-click **`stop.bat`** or press `Ctrl+C` in the terminal.

## 📋 Commands

| Command | Description |
|---------|-------------|
| `npm start` | Build + start server |
| `npm run build` | Build backend + frontend |
| `npm run dev` | Watch mode (backend + frontend dev server) |
| `stop.bat` | Kill server on port 3000 |

## 🌐 Access

Open your browser: `http://localhost:3000`

## 🎮 Usage

1. **Create Game** — Select scenario, create character, start adventure
2. **Join Game** — Share the link, other players join with their character
3. **Actions** — Use preset buttons (Attack, Search, Talk, etc.) or type freely
4. **Settings** — ⚙️ button on welcome screen or game header for LLM config

## 📦 Requirements

- **Node.js** 18+
- **LM Studio** / Ollama / OpenAI API (for AI Dungeon Master)
