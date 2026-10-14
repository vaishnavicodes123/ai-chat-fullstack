import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/chat", rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute and try again." }
}));

const templates = {
  general: {
    label: "General assistant",
    instruction: "You are a helpful, clear, friendly assistant. Answer accurately and explain unfamiliar terms simply."
  },
  tutor: {
    label: "Study tutor",
    instruction: "You are a patient study tutor. Explain step by step, use a small example when helpful, and check understanding. Do not simply give unexplained answers."
  },
  coding: {
    label: "Coding helper",
    instruction: "You are a practical programming mentor. Give correct code, explain where it belongs, list run steps, and help debug errors. Never claim code was executed unless it actually was."
  },
  writing: {
    label: "Writing assistant",
    instruction: "You are a writing assistant. Improve clarity and grammar while preserving the user's intended meaning. Ask for missing context only when necessary."
  }
};

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "AI Chat API is running." });
});

app.get("/api/templates", (_req, res) => {
  res.json(Object.entries(templates).map(([id, item]) => ({
    id, label: item.label
  })));
});

app.post("/api/chat", async (req, res) => {
  const { message, template = "general", history = [] } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please type a message before sending." });
  }
  if (message.length > 8000) {
    return res.status(413).json({ error: "That message is too long. Please keep it under 8,000 characters." });
  }
  if (!templates[template]) {
    return res.status(400).json({ error: "Please select a valid prompt template." });
  }
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "replace_with_your_api_key") {
    return res.status(503).json({
      error: "The AI service is not configured yet. Add your API key to the .env file, then restart the server."
    });
  }

  const safeHistory = Array.isArray(history)
    ? history.slice(-10).filter(item =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string" &&
        item.content.trim() &&
        item.content.length <= 8000
      )
    : [];

  const messages = [
    { role: "system", content: templates[template].instruction },
    ...safeHistory.map(({ role, content }) => ({ role, content })),
    { role: "user", content: message.trim() }
  ];

  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        stream: true,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(90000)
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return res.status(502).json({
      error: timeout
        ? "The AI service took too long to respond. Please try again."
        : "Could not connect to the AI service. Check your internet connection and try again."
    });
  }

  if (!upstream.ok) {
    let detail = "";
    try {
      const data = await upstream.json();
      detail = data?.error?.message || "";
    } catch {}
    if (upstream.status === 401) {
      return res.status(502).json({ error: "The API key was rejected. Check OPENAI_API_KEY in your .env file." });
    }
    if (upstream.status === 429) {
      return res.status(429).json({ error: "The AI service is busy or your API quota is exhausted. Check your provider's billing and usage, then try again." });
    }
    console.error("AI provider error:", upstream.status, detail);
    return res.status(502).json({ error: "The AI service could not complete this request. Please try again shortly." });
  }

  res.status(200);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Transfer-Encoding", "chunked");

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const token = parsed.choices?.[0]?.delta?.content;
          if (typeof token === "string") res.write(token);
        } catch {
          // Ignore malformed partial SSE frames from the upstream stream.
        }
      }
    }
  } catch (error) {
    console.error("Streaming error:", error.message);
    if (!res.headersSent) {
      return res.status(502).json({ error: "The response stream was interrupted. Please try again." });
    }
  } finally {
    res.end();
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on the server. Please try again." });
});

app.listen(PORT, () => {
  console.log(`AI Chat is running at http://localhost:${PORT}`);
});
