# DnD AI: The Dungeon Master Project Specifics

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

## Autonomous Permissions

The following operations may be performed **without asking for confirmation**:

| Operation | Scope | Notes |
|-----------|-------|-------|
| **Git** | `add`, `commit`, `push origin main`, branch create/delete/merge | Always push to `origin/main` unless specified otherwise |
| **Files** | Create, edit, delete any file in the project | Except `.env` (never commit secrets) |
| **Tests** | Run `npm test` / `npx vitest run` | After any code change that affects tested modules |
| **Build** | Run `npm run build` and `npx tsc --noEmit` | Verify compilation before pushing |

### Rules
- Always commit with descriptive messages following conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Push to remote after each significant change set (feature complete, bug fix, cleanup)
- Run tests + build verification **before** claiming work is done
- Never run `npm start` in automated tasks — use `node --check dist/src/server.js` or `timeout 5 npm start` instead

## Testing Servers
**CRITICAL**: Never run `npm start` directly in automated tasks — it will hang.
