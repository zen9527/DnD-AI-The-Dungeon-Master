# DnD Offline Multiplayer - Quick Start Guide

## 🚀 One-Click Deployment (Windows)

### Option 1: Foreground Mode (Recommended for Development)

Double-click **`start.bat`** to start the server with visible logs.

```
┌─────────────────────────────────────┐
│ DnD Offline Multiplayer Launcher    │
│ =================================   │
│ [INFO] Building project...          │
│ ✓ Build completed!                  │
│ =================================   │
│ Starting DnD Server...              │
│ URL: http://localhost:3000          │
│ Press Ctrl+C to stop                │
│ =================================   │
│ [WebSocket] WebSocket server init.  │
│ DnD Game Server running at ...      │
└─────────────────────────────────────┘
```

**Features:**
- ✅ Shows build progress and logs
- ✅ Auto-cleans port 3000 before starting
- ✅ Press `Ctrl+C` to stop gracefully

---

### Option 2: Background Mode (Recommended for Production)

Double-click **`start-bg.bat`** to start the server in background.

```
┌─────────────────────────────────────┐
│ DnD Offline Multiplayer Launcher    │
│ =================================   │
│ [INFO] Building project...          │
│ ✓ Build completed!                  │
│ =================================   │
│ Starting DnD Server in background.. │
│ URL: http://localhost:3000          │
│ =================================   │
│ [SUCCESS] Server started!           │
│ Process ID: 12345                   │
│ To stop, run: stop.bat              │
└─────────────────────────────────────┘
```

**Features:**
- ✅ No console window (runs in background)
- ✅ Auto-starts after build
- ✅ Shows process ID for manual control

---

### Stop the Server

Double-click **`stop.bat`** to stop the server.

```
┌─────────────────────────────────────┐
│ DnD Offline Multiplayer - Stop      │
│ =================================   │
│ [INFO] Looking for server...        │
│ Found process: 12345                │
│ Are you sure? (y/n): y              │
│ [SUCCESS] Server stopped.           │
└─────────────────────────────────────┘
```

---

## 📋 Scripts Overview

| Script | Mode | Use Case |
|--------|------|----------|
| `start.bat` | Foreground | Development, debugging |
| `start-bg.bat` | Background | Production, kiosk mode |
| `stop.bat` | - | Stop running server |

---

## 🔧 Manual Commands

If scripts don't work, you can run commands manually:

```bash
# Build project
npm run build

# Start server (foreground)
npm start

# Check if server is running
netstat -ano | findstr :3000

# Stop server by PID
taskkill /F /PID <process_id>
```

---

## 🐛 Troubleshooting

### Port 3000 already in use

The scripts automatically kill existing processes on port 3000. If it still fails:

1. Run `stop.bat`
2. Check manually: `netstat -ano | findstr :3000`
3. Kill process: `taskkill /F /PID <pid>`

### Build fails

Check that you have all dependencies installed:

```bash
npm install
```

### Node.js not found

Install Node.js from https://nodejs.org/ and restart your terminal.

---

## 📦 Requirements

- **Node.js** 18+ (https://nodejs.org/)
- **Windows** 10/11
- **npm** (comes with Node.js)

---

## 🌐 Access the Application

Once started, open your browser:

- **Local**: http://localhost:3000
- **Network**: http://<your-ip>:3000

For network access, make sure port 3000 is not blocked by firewall.

---

## 🎮 Usage

1. **DM (Dungeon Master)**: Open browser → Click "Create New Game"
2. **Players**: Open the shared link → Enter name and character → Join game
3. **Features**: Chat, dice rolling, NPC/event generation (with LM Studio)

---

## 📝 Notes

- Server automatically rebuilds when you run `start.bat` after code changes
- Logs are visible in foreground mode (`start.bat`)
- Background mode (`start-bg.bat`) is silent - use `stop.bat` to stop
- All scripts handle port cleanup automatically
