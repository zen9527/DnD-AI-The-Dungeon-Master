# DnD Full Auto-DM Project Specifics

## Tech Stack
- **Backend**: Node.js + TypeScript + Express + ws (WebSocket)
- **Frontend**: TypeScript + Vite
- **Validation**: Zod (shared between backend and frontend)
- **Build**: `npm run build` (builds backend + frontend)

## Project Structure
```
src/           # Backend TypeScript source
  ├── server.ts
  ├── game/    # Dice engine, rules engine, game engine, store
  ├── llm/     # LLM client, parser, prompts
  ├── types/   # Core D&D types
  ├── utils/   # ID generator
  └── websocket/
shared/        # Shared Zod schemas (game, action, chat, config, scenario)
public/        # Frontend source (TypeScript + CSS + HTML)
dist/          # Compiled output (excluded from git)
```

## Development Commands
- `npm run build` - Full build (backend + frontend)
- `npm run dev` - Concurrent watch mode (backend + frontend dev server)
- `npm start` - Build + start production server
- `npx tsc --noEmit` - Type check without compilation
- `start.bat` - Build + start (Windows)
- `stop.bat` - Kill server on port 3000 (Windows)

## Testing Servers
**CRITICAL**: Never run `npm start` directly in automated tasks — it will hang.
