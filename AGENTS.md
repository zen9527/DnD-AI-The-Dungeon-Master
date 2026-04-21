# DnD Offline Multiplayer Project Specifics

## Tech Stack
- **Backend**: Node.js + TypeScript + Express + ws (WebSocket)
- **Frontend**: TypeScript + Vite
- **Validation**: Zod (shared between backend and frontend)
- **Build**: `npm run build:backend` + `npm run build:frontend`

## Project Structure
```
src/           # Backend TypeScript source
  ├── server.ts
  ├── types/
  ├── schemas/
  └── utils/
shared/        # Shared types and schemas for frontend
public/        # Frontend source (TypeScript)
dist/          # Compiled output
```

## Development Commands
- `npm run build` - Full build (backend + frontend)
- `npm run dev` - Concurrent development (watch mode)
- `npm start` - Start production server (use timeout for testing!)
- `npx tsc --noEmit` - Type check without compilation

## Testing Servers
**CRITICAL**: Always use `timeout 3 npm start` when testing server startup.
Never run `npm start` directly in automated tasks - it will hang subagents.

---

# Global Rules Reference

The following global rules apply to this project (defined in ~/.config/opencode/AGENTS.md):

## Windows Environment Detection
- ALWAYS check if running on Windows before executing commands
- Use PowerShell cmdlets instead of Unix commands where applicable

## Server Testing Rules
- NEVER run `npm start` directly - use `timeout 3 npm start` or `node --check`
- Background processes will hang subagents indefinitely

## Development Workflow
- Before starting any implementation: Check if a skill applies using the Skill tool
- For multi-step tasks: Use writing-plans skill to create implementation plans
- For parallel independent tasks: Use subagent-driven-development skill
