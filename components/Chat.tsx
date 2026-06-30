"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { callApi } from "@/lib/api";
import { type ApiConfig, loadConfig, saveConfig } from "@/lib/config";
import {
  type Conversation,
  deleteConversationApi,
  fetchConversations,
  newConversation,
  sortByRecent,
  titleFrom,
  upsertConversation,
} from "@/lib/conversations";
import type { ChatMessage } from "@/lib/types";
import Settings from "./Settings";
import Sidebar from "./Sidebar";

export default function Chat() {
  const [config, setConfig] = useState<ApiConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const started = messages.length > 0;

  // --- Chargement initial (utilisateur + conversations) ---
  useEffect(() => {
    setConfig(loadConfig());

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.user && setEmail(d.user.email))
      .catch(() => {});

    fetchConversations()
      .then((list) => {
        if (list.length === 0) list = [newConversation()];
        setConversations(list);
        setActiveId(sortByRecent(list)[0].id);
      })
      .catch(() => {
        const c = newConversation();
        setConversations([c]);
        setActiveId(c.id);
      });
  }, []);

  function updateConfig(next: ApiConfig) {
    setConfig(next);
    saveConfig(next);
  }

  function scrollToBottom() {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

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
    deleteConversationApi(id).catch(() => {});
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

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
      setBusy(false);
      // fige le flag streaming et persiste la conversation côté serveur
      setConversations((prev) => {
        const next = prev.map((c) => {
          if (c.id !== convId) return c;
          const msgs = c.messages.map((m, i) =>
            i === assistantIndex ? { ...m, streaming: false } : m
          );
          return { ...c, messages: msgs };
        });
        const toSave = next.find((c) => c.id === convId);
        if (toSave) upsertConversation(toSave).catch(() => {});
        return next;
      });
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
            {email && <span className="masthead__user">{email}</span>}
            <button className="navbtn" onClick={handleLogout} title="Déconnexion">
              Déconnexion
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
