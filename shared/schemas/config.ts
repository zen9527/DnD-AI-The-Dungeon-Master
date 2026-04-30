import { z } from "zod";

export const configSchema = z.object({
  llmBaseUrl: z.string().url().min(1),
  llmApiKey: z.string().min(0),
  llmModel: z.string().min(0),
});

export type ConfigInput = z.infer<typeof configSchema>;

export const endpointPresets = [
  {
    name: "LM Studio",
    url: "http://localhost:1234/v1",
    apiKey: "",
    model: "",
  },
  {
    name: "Ollama",
    url: "http://localhost:11434/v1",
    apiKey: "",
    model: "",
  },
  {
    name: "OpenAI",
    url: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4",
  },
  {
    name: "Together AI",
    url: "https://api.together.xyz/v1",
    apiKey: "",
    model: "meta-llama/Meta-Llama-3-8B-Instruct-Turbo",
  },
  {
    name: "Groq",
    url: "https://api.groq.com/openai/v1",
    apiKey: "",
    model: "llama3-70b-8192",
  },
  {
    name: "BigModel (GLM)",
    url: "https://open.bigmodel.cn/api/paas/v4",
    apiKey: "",
    model: "",
  },
  {
    name: "Custom",
    url: "",
    apiKey: "",
    model: "",
  },
] as const;

export type EndpointPreset = (typeof endpointPresets)[number];
