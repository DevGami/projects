"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, X, Send, Sparkles, Bot, User, Loader2,
  History, Plus, Trash2, ChevronLeft, AlertCircle, RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
}

interface Session {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string;
}

const SUGGESTIONS = [
  "What action movies are playing now?",
  "Best movies for family this week?",
  "Top rated movies in your database?",
  "Any horror movies available?",
];

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1");
const STREAM_TIMEOUT_MS = 50_000; // 50 second client-side timeout

// ── Full Markdown Renderer ────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  // Split into blocks by double newlines
  const blocks = text.split(/\n\n+/);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");

        // Heading detection
        if (lines[0]?.startsWith("### ")) {
          return (
            <h4 key={bi} className="text-xs font-bold text-brand-300 uppercase tracking-wider mt-1">
              {parseInline(lines[0].slice(4))}
            </h4>
          );
        }
        if (lines[0]?.startsWith("## ")) {
          return (
            <h3 key={bi} className="text-sm font-bold text-white mt-1">
              {parseInline(lines[0].slice(3))}
            </h3>
          );
        }
        if (lines[0]?.startsWith("# ")) {
          return (
            <h2 key={bi} className="text-base font-bold text-white mt-1">
              {parseInline(lines[0].slice(2))}
            </h2>
          );
        }

        // Code block
        if (block.startsWith("```")) {
          const code = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
          return (
            <pre key={bi} className="bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap">
              <code>{code}</code>
            </pre>
          );
        }

        // List block
        const isList = lines.every(l => l.match(/^[-*•]\s/) || l.match(/^\d+\.\s/) || l.trim() === "");
        if (isList) {
          const items = lines.filter(l => l.trim() !== "");
          const isOrdered = items[0]?.match(/^\d+\./);
          const Tag = isOrdered ? "ol" : "ul";
          return (
            <Tag key={bi} className={`pl-4 space-y-0.5 ${isOrdered ? "list-decimal" : "list-disc"}`}>
              {items.map((item, ii) => (
                <li key={ii} className="text-slate-200">
                  {parseInline(item.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, ""))}
                </li>
              ))}
            </Tag>
          );
        }

        // Table detection
        if (lines.length >= 2 && lines[0]?.includes("|") && lines[1]?.includes("---")) {
          const headers = lines[0].split("|").map(h => h.trim()).filter(Boolean);
          const rows = lines.slice(2).map(r => r.split("|").map(c => c.trim()).filter(Boolean));
          return (
            <div key={bi} className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr>
                    {headers.map((h, hi) => (
                      <th key={hi} className="border border-white/10 px-2 py-1 text-left text-brand-300 font-semibold bg-surface-900">
                        {parseInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-white/5 hover:bg-surface-700">
                      {row.map((cell, ci) => (
                        <td key={ci} className="border border-white/10 px-2 py-1 text-slate-300">
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Regular paragraph
        return (
          <p key={bi} className="text-slate-200">
            {lines.map((line, li) => (
              <span key={li}>
                {parseInline(line)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function parseInline(text: string): React.ReactNode {
  // Split on bold (**), italic (*), and inline code (`)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i} className="italic text-slate-300">{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-surface-900 text-green-300 rounded px-1 text-[11px] font-mono">{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AiChat() {
  const { isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I am your AI movie assistant. Ask me anything — what is playing, genre recommendations, movie details, or what should I watch tonight?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if AI is configured
  useEffect(() => {
    fetch(`${API_BASE}/ai/status`)
      .then((r) => r.json())
      .then((d) => setAvailable(d.data?.available ?? false))
      .catch(() => setAvailable(false));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && view === "chat") setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, view]);

  // Load sessions when switching to history view
  useEffect(() => {
    if (view === "history" && isAuthenticated) fetchSessions();
  }, [view, isAuthenticated]);

  async function fetchSessions() {
    setLoadingSessions(true);
    try {
      const token = localStorage.getItem("bys_access_token");
      const res = await fetch(`${API_BASE}/ai/sessions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setSessions(data.data.sessions);
    } catch {}
    setLoadingSessions(false);
  }

  async function loadSession(sessionId: string) {
    try {
      const token = localStorage.getItem("bys_access_token");
      const res = await fetch(`${API_BASE}/ai/sessions/${sessionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        const msgs: Message[] = data.data.session.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        }));
        setMessages(msgs);
        setCurrentSessionId(sessionId);
        setView("chat");
      }
    } catch {}
  }

  async function deleteSessionById(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("bys_access_token");
      await fetch(`${API_BASE}/ai/sessions/${sessionId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([{
          role: "assistant",
          content: "Hi! I am your AI movie assistant. Ask me anything about movies!",
        }]);
      }
    } catch {}
  }

  function startNewChat() {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCurrentSessionId(null);
    setMessages([{
      role: "assistant",
      content: "Hi! I am your AI movie assistant. Ask me anything about movies!",
    }]);
    setInput("");
    setLoading(false);
    setView("chat");
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    // Client-side timeout — never stay stuck
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
    }, STREAM_TIMEOUT_MS);

    const markError = (msg: string) => {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content: msg, streaming: false, error: true }
            : m
        )
      );
    };

    try {
      const token = localStorage.getItem("bys_access_token");
      const history = messages
        .filter((m) => !m.streaming && !m.error)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          history,
          ...(currentSessionId ? { sessionId: currentSessionId } : {}),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("AI service unavailable");
      }

      // Capture session ID from response headers
      const newSessionId = res.headers.get("X-Session-Id");
      if (newSessionId && !currentSessionId) {
        setCurrentSessionId(newSessionId);
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
                prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
              );
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            } else if (json.error) {
              markError(`I encountered an issue: ${json.error}`);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            } else if (json.content) {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: m.content + json.content } : m
                )
              );
            }
          } catch {}
        }
      }

      // Ensure streaming is always resolved
      setMessages((prev) =>
        prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
      );
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (err.name === "AbortError") {
        markError("Request timed out. Please try again with a shorter question.");
      } else {
        markError("Connection error. Please check your network and try again.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [loading, messages, currentSessionId]);

  return (
    <>
      {/* Floating button */}
      <motion.button
        id="ai-chat-toggle"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 shadow-2xl flex items-center justify-center text-white"
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
            className="fixed bottom-24 left-6 z-50 w-[400px] max-w-[calc(100vw-24px)] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ height: "560px" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-brand-600 to-accent-600 shrink-0">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Movie AI Assistant</p>
                <p className="text-[10px] text-white/70 flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${available ? "bg-green-400" : "bg-red-400"}`} />
                  {available ? "Powered by Llama 3.1" : "AI unavailable"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {isAuthenticated && (
                  <>
                    <button
                      onClick={() => setView(v => v === "history" ? "chat" : "history")}
                      className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                      title="Chat history"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={startNewChat}
                      className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                      title="New chat"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* History View */}
            {view === "history" ? (
              <div className="flex-1 overflow-y-auto bg-surface-900 p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Previous Conversations</p>
                {loadingSessions ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 text-brand-400 animate-spin" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-500">No saved conversations yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        className="w-full text-left p-3 rounded-xl bg-surface-800 border border-white/8 hover:border-brand-500/30 transition group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate group-hover:text-brand-300 transition">{s.title}</p>
                            {s.preview && (
                              <p className="text-xs text-slate-500 truncate mt-0.5">{s.preview}</p>
                            )}
                            <p className="text-[10px] text-slate-600 mt-1">{s.messageCount} messages</p>
                          </div>
                          <button
                            onClick={(e) => deleteSessionById(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center text-red-400 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Chat View */
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-surface-900">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-white ${msg.role === "user" ? "bg-brand-500" : "bg-gradient-to-br from-purple-500 to-accent-500"}`}>
                        {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>

                      <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${
                        msg.role === "user"
                          ? "bg-brand-500 text-white rounded-tr-sm text-sm"
                          : msg.error
                          ? "bg-red-900/30 border border-red-500/30 rounded-tl-sm"
                          : "bg-surface-800 text-slate-200 border border-white/8 rounded-tl-sm"
                      }`}>
                        {msg.content ? (
                          msg.role === "user" ? (
                            <span className="text-sm">{msg.content}</span>
                          ) : msg.error ? (
                            <div className="flex items-start gap-1.5">
                              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                              <span className="text-sm text-red-300">{msg.content}</span>
                            </div>
                          ) : (
                            renderMarkdown(msg.content)
                          )
                        ) : msg.streaming ? (
                          <span className="flex items-center gap-1.5 text-slate-400 text-sm">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Thinking…
                          </span>
                        ) : null}
                        {msg.streaming && msg.content && (
                          <span className="inline-block w-0.5 h-3.5 bg-brand-400 animate-pulse ml-0.5 align-middle" />
                        )}
                        {msg.error && (
                          <button
                            onClick={() => sendMessage(messages[i - 1]?.content || "")}
                            className="mt-2 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition"
                          >
                            <RefreshCw className="h-3 w-3" /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Suggestions */}
                {messages.length === 1 && available && (
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
                    placeholder={available ? "Ask about movies…" : "AI unavailable"}
                    disabled={loading || !available}
                    className="flex-1 bg-surface-900 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50 disabled:opacity-50"
                  />
                  {loading ? (
                    <button
                      onClick={() => { if (abortRef.current) abortRef.current.abort(); }}
                      className="h-9 w-9 rounded-xl bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center text-red-400 transition"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      id="ai-chat-send"
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim() || !available}
                      className="h-9 w-9 rounded-xl bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-white transition disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
