"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { callApi } from "@/lib/api";
import { type ApiConfig, loadConfig, saveConfig } from "@/lib/config";
import {
  type Conversation,
  loadConversations,
  newConversation,
  saveConversations,
  sortByRecent,
  titleFrom,
} from "@/lib/conversations";
import type { ChatMessage } from "@/lib/types";
import Settings from "./Settings";
import Sidebar from "./Sidebar";

export default function Chat() {
  const [config, setConfig] = useState<ApiConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const started = messages.length > 0;

  // --- Hydratation depuis le localStorage (évite le mismatch SSR) ---
  useEffect(() => {
    setConfig(loadConfig());
    let list = loadConversations();
    if (list.length === 0) list = [newConversation()];
    setConversations(list);
    setActiveId(sortByRecent(list)[0].id);
    setHydrated(true);
  }, []);

  // --- Persistance (debounced) ---
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveConversations(conversations), 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [conversations, hydrated]);

  function updateConfig(next: ApiConfig) {
    setConfig(next);
    saveConfig(next);
  }

  function scrollToBottom() {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  /** Met à jour une conversation précise par son id. */
  function patchConv(id: string, fn: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }

  function createConversation() {
    const c = newConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
    setError("");
    setSidebarOpen(false);
  }

  function selectConversation(id: string) {
    setActiveId(id);
    setError("");
    setSidebarOpen(false);
  }

  function deleteConversation(id: string) {
    const remaining = conversations.filter((c) => c.id !== id);
    const next = remaining.length ? remaining : [newConversation()];
    setConversations(next);
    if (id === activeId) setActiveId(sortByRecent(next)[0].id);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    // garantit une conversation active
    let conv = active;
    if (!conv) {
      conv = newConversation();
      setConversations((prev) => [conv as Conversation, ...prev]);
      setActiveId(conv.id);
    }
    const convId = conv.id;

    const apiMessages: ChatMessage[] = [
      ...conv.messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ];
    const assistantIndex = conv.messages.length + 1;
    const isFirst = conv.messages.length === 0;

    patchConv(convId, (c) => ({
      ...c,
      title: isFirst ? titleFrom(text) : c.title,
      messages: [
        ...c.messages,
        { role: "user", content: text },
        { role: "assistant", content: "", streaming: true },
      ],
      updatedAt: Date.now(),
    }));
    setInput("");
    setBusy(true);
    setError("");
    requestAnimationFrame(scrollToBottom);

    try {
      await callApi(config, apiMessages, (chunk) => {
        patchConv(convId, (c) => {
          const msgs = [...c.messages];
          const m = msgs[assistantIndex];
          if (m) msgs[assistantIndex] = { ...m, content: m.content + chunk };
          return { ...c, messages: msgs, updatedAt: Date.now() };
        });
        scrollToBottom();
      });
    } catch (err) {
      patchConv(convId, (c) => {
        const msgs = [...c.messages];
        msgs[assistantIndex] = {
          role: "assistant",
          content:
            "⚠️ Impossible de joindre le serveur d'inférence. Vérifie la config serveur (INFERENCE_BASE_URL / INFERENCE_API_KEY) et le modèle.",
        };
        return { ...c, messages: msgs };
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      patchConv(convId, (c) => {
        const msgs = [...c.messages];
        const m = msgs[assistantIndex];
        if (m) msgs[assistantIndex] = { ...m, streaming: false };
        return { ...c, messages: msgs };
      });
      setBusy(false);
    }
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead__inner">
          <button
            className="navbtn navbtn--menu"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Conversations"
            title="Conversations"
          >
            ☰
          </button>
          <div className="logo">
            Inference<span className="logo__accent"> Console</span>
          </div>
          <nav className="masthead__nav">
            <span className="badge">
              {config.provider === "ollama" ? "Ollama" : "OpenAI"} ·{" "}
              {config.model}
            </span>
            <button className="navbtn" onClick={() => setShowSettings(true)}>
              ⚙ Réglages
            </button>
          </nav>
        </div>
      </header>

      <div className="layout">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          open={sidebarOpen}
          onSelect={selectConversation}
          onNew={createConversation}
          onDelete={deleteConversation}
          onClose={() => setSidebarOpen(false)}
        />

        <section className="chat-area">
          <div className="chat">
            {!started && (
              <section className="chat__intro">
                <p className="kicker">Console de test · Inférence</p>
                <h1 className="headline">Testez votre modèle.</h1>
                <p className="subhead">
                  Interface de chat connectée en temps réel au serveur
                  d&apos;inférence (protocole{" "}
                  {config.provider === "ollama" ? "Ollama" : "OpenAI-compatible"},
                  modèle <code>{config.model}</code>).
                </p>
              </section>
            )}

            <section className="chat__log" aria-live="polite">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`msg ${
                    msg.role === "user" ? "msg--user" : "msg--bot"
                  }`}
                >
                  <div className="msg__role">
                    {msg.role === "user" ? "Vous" : "Assistant"}
                  </div>
                  <div className="msg__bubble">
                    {msg.streaming && msg.content === "" ? (
                      <span className="typing">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </section>

            <form
              className="composer"
              onSubmit={handleSubmit}
              autoComplete="off"
            >
              <input
                className="composer__input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Écrivez votre message…"
                aria-label="Votre message"
                disabled={busy}
              />
              <button
                className="composer__send"
                type="submit"
                disabled={busy}
              >
                Envoyer
              </button>
            </form>
            <p
              className={`composer__hint ${
                error ? "composer__hint--error" : ""
              }`}
            >
              {error}
            </p>
          </div>
        </section>
      </div>

      {showSettings && (
        <Settings
          config={config}
          onChange={updateConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
