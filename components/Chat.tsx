"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { callApi } from "@/lib/api";
import { type ApiConfig, loadConfig, saveConfig } from "@/lib/config";
import type { ChatMessage } from "@/lib/types";
import Settings from "./Settings";

interface DisplayMessage extends ChatMessage {
  /** vrai pendant la réception du flux pour cette bulle assistant */
  streaming?: boolean;
}

export default function Chat() {
  const [config, setConfig] = useState<ApiConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  const started = messages.length > 0;

  // recharge la config persistée au montage (évite le mismatch SSR)
  useEffect(() => setConfig(loadConfig()), []);

  function updateConfig(next: ApiConfig) {
    setConfig(next);
    saveConfig(next);
  }

  function scrollToBottom() {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function resetChat() {
    setMessages([]);
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const history: ChatMessage[] = messages.map(({ role, content }) => ({
      role,
      content,
    }));
    const next: ChatMessage[] = [...history, { role: "user", content: text }];

    setMessages([...next, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setBusy(true);
    setError("");
    requestAnimationFrame(scrollToBottom);

    const assistantIndex = next.length;

    try {
      await callApi(config, next, (chunk) => {
        setMessages((prev) => {
          const copy = [...prev];
          const msg = copy[assistantIndex];
          if (msg)
            copy[assistantIndex] = { ...msg, content: msg.content + chunk };
          return copy;
        });
        scrollToBottom();
      });
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIndex] = {
          role: "assistant",
          content:
            "⚠️ Impossible de joindre le serveur d'inférence. Vérifie la config serveur (INFERENCE_BASE_URL / INFERENCE_API_KEY) et le modèle.",
        };
        return copy;
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMessages((prev) => {
        const copy = [...prev];
        const msg = copy[assistantIndex];
        if (msg) copy[assistantIndex] = { ...msg, streaming: false };
        return copy;
      });
      setBusy(false);
    }
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead__inner">
          <div className="logo">
            Inference<span className="logo__accent"> Console</span>
          </div>
          <nav className="masthead__nav">
            <span className="badge">
              {config.provider === "ollama" ? "Ollama" : "OpenAI"} · {config.model}
            </span>
            {started && (
              <button className="navbtn" onClick={resetChat} title="Nouvelle conversation">
                Effacer
              </button>
            )}
            <button
              className="navbtn"
              onClick={() => setShowSettings(true)}
              title="Réglages du serveur"
            >
              ⚙ Réglages
            </button>
          </nav>
        </div>
      </header>

      <main className="chat">
        {!started && (
          <section className="chat__intro">
            <p className="kicker">Console de test · Inférence</p>
            <h1 className="headline">Testez votre modèle.</h1>
            <p className="subhead">
              Interface de chat connectée en temps réel au serveur d&apos;inférence
              (protocole {config.provider === "ollama" ? "Ollama" : "OpenAI-compatible"},
              modèle <code>{config.model}</code>).
            </p>
          </section>
        )}

        <section className="chat__log" aria-live="polite">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`msg ${msg.role === "user" ? "msg--user" : "msg--bot"}`}
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

        <form className="composer" onSubmit={handleSubmit} autoComplete="off">
          <input
            className="composer__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Écrivez votre message…"
            aria-label="Votre message"
            disabled={busy}
          />
          <button className="composer__send" type="submit" disabled={busy}>
            Envoyer
          </button>
        </form>
        <p className={`composer__hint ${error ? "composer__hint--error" : ""}`}>
          {error}
        </p>
      </main>

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
