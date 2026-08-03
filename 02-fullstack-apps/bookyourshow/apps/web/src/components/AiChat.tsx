"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "What action movies are playing now?",
  "Best movies for family this week?",
  "Top rated movies in your database?",
  "Any horror movies available?",
];

// ── Simple inline markdown renderer ─────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Bold: **text** or *text*
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    const inline = parts.map((p, j) => {
      if (p.startsWith("**") && p.endsWith("**"))
        return <strong key={j} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*"))
        return <em key={j}>{p.slice(1, -1)}</em>;
      return p;
    });
    // Bullet list
    const isBullet = line.match(/^[*\-•]\s/);
    if (isBullet) {
      return (
        <li key={i} className="ml-3 list-disc list-outside">
          {inline.map((p, j) =>
            typeof p === "string" ? p.replace(/^[*\-•]\s/, "") : p
          )}
        </li>
      );
    }
    // Empty line → spacer
    if (line.trim() === "") return <br key={i} />;
    return <span key={i} className="block">{inline}</span>;
  });
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! 👋 I'm your AI movie assistant. Ask me anything — what's playing, genre recommendations, movie details, or just 'what should I watch tonight?'",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Base API URL — NEXT_PUBLIC_API_URL already includes /api/v1
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1");

  // Check if AI is configured
  useEffect(() => {
    fetch(`${API_BASE}/ai/status`)
      .then((r) => r.json())
      .then((d) => setAvailable(d.data?.available ?? false))
      .catch(() => setAvailable(false));
  }, [API_BASE]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => !m.streaming)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(
        `${API_BASE}/ai/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
        },
      );

      if (!res.ok || !res.body) {
        throw new Error("AI service unavailable");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.done) {
              setMessages((prev) =>
                prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m)),
              );
            } else if (json.error) {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1
                    ? { ...m, content: `⚠️ ${json.error}`, streaming: false }
                    : m,
                ),
              );
            } else if (json.content) {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: m.content + json.content } : m,
                ),
              );
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content: "⚠️ Couldn't connect to AI. Make sure the API is running.", streaming: false }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <motion.button
        id="ai-chat-toggle"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 shadow-2xl flex items-center justify-center text-white"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open AI movie assistant"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Pulse ring */}
        {!open && (
          <span className="absolute inset-0 rounded-full bg-brand-500 animate-ping opacity-20" />
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-24px)] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ height: "520px" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-brand-600 to-accent-600 shrink-0">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Movie AI Assistant</p>
                <p className="text-[10px] text-white/70 flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${available ? "bg-green-400" : "bg-red-400"}`} />
                  {available ? "Powered by Llama 3.1" : "AI unavailable"}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-surface-900">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-white ${msg.role === "user" ? "bg-brand-500" : "bg-gradient-to-br from-purple-500 to-accent-500"}`}>
                    {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-brand-500 text-white rounded-tr-sm"
                        : "bg-surface-800 text-slate-200 border border-white/8 rounded-tl-sm"
                    }`}
                  >
                    {msg.content ? (
                      <ul className="space-y-0.5">{renderMarkdown(msg.content)}</ul>
                    ) : msg.streaming ? (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking…
                      </span>
                    ) : null}
                    {msg.streaming && msg.content && (
                      <span className="inline-block w-0.5 h-3.5 bg-brand-400 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions — only show when no user messages yet */}
            {messages.length === 1 && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5 bg-surface-900 shrink-0">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-brand-500/30 text-brand-300 hover:bg-brand-500/10 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-3 py-3 bg-surface-800 border-t border-white/8 flex items-center gap-2 shrink-0">
              <input
                ref={inputRef}
                id="ai-chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                placeholder="Ask about movies…"
                disabled={loading}
                className="flex-1 bg-surface-900 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50 disabled:opacity-50"
              />
              <button
                id="ai-chat-send"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="h-9 w-9 rounded-xl bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-white transition disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
