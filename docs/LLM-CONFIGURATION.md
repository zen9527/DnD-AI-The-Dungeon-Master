# LLM API 配置指南

本项目的 LLM（大语言模型）功能支持任何 **OpenAI 兼容的 API**，包括本地服务和云端服务。

## 📋 快速开始

### 1. 复制环境变量文件

```bash
cp .env.example .env
```

### 2. 编辑 `.env` 文件

根据你的需求选择一种配置方式：

#### **选项 A: LM Studio (本地推荐)**

```env
VITE_LLM_API_URL=http://localhost:1234/v1
VITE_LLM_API_KEY=
```

**步骤：**
1. 下载并安装 [LM Studio](https://lmstudio.ai/)
2. 在 LM Studio 中下载一个模型（如 `Llama-3.1-8B`）
3. 启动本地服务器（默认端口 `1234`）
4. 如果你的 LM Studio 运行在非标准端口，修改 URL

#### **选项 B: OpenAI**

```env
VITE_LLM_API_URL=https://api.openai.com/v1
VITE_LLM_API_KEY=sk-your-openai-key-here
```

#### **选项 C: Ollama (本地)**

```env
VITE_LLM_API_URL=http://localhost:11434/v1
VITE_LLM_API_KEY=
```

## 🔧 支持的提供商

| 提供商 | URL 格式 | API Key | 说明 |
|--------|---------|---------|------|
| **LM Studio** | `http://localhost:1234/v1` | ❌ 可选 | 本地运行，完全免费 |
| **Ollama** | `http://localhost:11434/v1` | ❌ 不需要 | 本地运行，完全免费 |
| **OpenAI** | `https://api.openai.com/v1` | ✅ 必需 | GPT-3.5/4, 按使用付费 |
| **Together AI** | `https://api.together.xyz/v1` | ✅ 必需 | 多种开源模型，免费额度 |
| **Groq** | `https://api.groq.com/openai/v1` | ✅ 必需 | 超高速推理，免费额度 |

## 🎨 前端 UI 配置

除了 `.env` 文件，你还可以在网页的 **DM Panel** 中动态配置：

### 使用预设提供商

1. 打开应用，进入游戏界面
2. 右侧 DM Panel → "LLM Provider" 下拉菜单
3. 选择预设（LM Studio、OpenAI、Ollama 等）
4. URL 会自动填充

### 自定义配置

1. 在 "API URL" 输入框中手动输入完整 URL
   - **格式**: `http://host:port/v1`
   - **示例**: `http://192.168.1.107:12340/v1`
2. 如果需要 API Key，在 "API Key" 中输入
3. 点击 "Test Connection" 测试连接
4. 点击 "Refresh Models" 加载可用模型列表

## 🔒 隐私和安全

### `.env` 文件保护

- ✅ `.env` 文件已在 `.gitignore` 中，**不会被提交到 Git**
- ✅ 你的 API Key 只存储在本地
- ✅ 其他开发者克隆项目后需要自己配置 `.env`

### 浏览器 localStorage

- ⚠️ 前端 UI 的配置会存储在浏览器的 `localStorage` 中
- ⚠️ 这只是为了方便，不影响 `.env` 的隐私性
- ⚠️ 清除浏览器数据会删除这些设置

## 🧪 测试连接

### LM Studio 本地测试

```bash
# 检查 LM Studio 是否运行
curl http://localhost:1234/v1/models

# 应该返回模型列表
{"object":"list","data":[...]}
```

### OpenAI API 测试

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key"
```

## 🐛 故障排除

### 问题 1: "Test Connection" 显示失败

**检查清单：**
- [ ] LM Studio / Ollama 是否正在运行？
- [ ] URL 格式是否正确（必须以 `/v1` 结尾）？
- [ ] 端口号是否正确？
- [ ] 防火墙是否阻止了连接？

### 问题 2: "Refresh Models" 返回空列表

**可能原因：**
- LM Studio 还没有加载任何模型
- API Key 无效（对于云端服务）
- 网络连接问题

**解决方法：**
1. 在 LM Studio GUI 中下载并加载一个模型
2. 检查 API Key 是否正确
3. 查看浏览器控制台（F12）的错误信息

### 问题 3: 生成内容失败

**检查：**
- 选中的模型是否已加载？
- 模型的上下文长度是否足够？
- LM Studio 服务器日志是否有错误？

## 📚 更多资源

- [LM Studio 官方文档](https://lmstudio.ai/docs)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [Ollama 官方文档](https://ollama.ai/docs)

## 💡 提示

1. **本地开发**: 推荐使用 LM Studio，完全免费且离线可用
2. **生产环境**: 使用云端服务（OpenAI、Together）更稳定
3. **测试切换**: 在前端 UI 中可以随时切换不同提供商，无需重启服务器
4. **模型选择**: 本地推荐 `Llama-3.1-8B`，云端推荐 `gpt-4o-mini`
