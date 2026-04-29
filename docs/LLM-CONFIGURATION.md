# LLM Configuration

The DnD server connects to any **OpenAI-compatible API** (LM Studio, Ollama, OpenAI, etc.).

## Setup

### 1. Configure `.env`

Copy `.env.example` to `.env` and set your LLM endpoint:

```env
PORT=3000
HOST=0.0.0.0

LLM_API_URL=http://192.168.1.107:12340/v1
LLM_API_KEY=your-api-key
LLM_MODEL=model-name
```

- `LLM_API_URL` — Full URL including `/v1` (e.g., `http://localhost:1234/v1`)
- `LLM_API_KEY` — Optional for local models (LM Studio, Ollama)
- `LLM_MODEL` — Model name from your LLM provider

### 2. Restart Server

```
stop.bat
start.bat
```

### 3. Configure via UI (Optional)

Click ⚙️ in the welcome screen or game header to:
- Select a preset endpoint (LM Studio, Ollama, OpenAI, etc.)
- Fetch available models from the endpoint
- Test the connection
- Save settings (requires server restart)

## Supported Providers

| Provider | URL | API Key |
|----------|-----|---------|
| LM Studio | `http://localhost:1234/v1` | Optional |
| Ollama | `http://localhost:11434/v1` | None |
| OpenAI | `https://api.openai.com/v1` | Required |
| Together AI | `https://api.together.xyz/v1` | Required |
| Groq | `https://api.groq.com/openai/v1` | Required |

## Troubleshooting

### "DM fetch failed" / "LLM endpoint unreachable"

1. Ensure LM Studio (or your provider) is running
2. Verify the URL and port in `.env`
3. Check firewall/antivirus is not blocking the connection
4. Restart the server after changing `.env`

### "Refresh Models" returns empty list

1. Make sure a model is loaded in LM Studio
2. Verify the API URL is correct (must end with `/v1`)
3. Check the API key if using a cloud provider
