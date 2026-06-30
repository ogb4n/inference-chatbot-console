import type { ChatMessage } from "./types";
import type { ApiConfig } from "./config";

/* =====================================================================
 *  COUCHE API (client) — passe par le proxy Next /api/*
 * =====================================================================
 *  Le navigateur appelle toujours la même origine ("/api/chat"), ce qui
 *  évite tout problème de CORS. C'est le serveur Next qui ajoute la clé
 *  d'API et relaie vers le serveur d'inférence (cf. app/api/chat/route.ts).
 *  Le flux est renvoyé brut : on le parse ici selon le provider.
 * ===================================================================== */

/**
 * Envoie la conversation et renvoie la réponse complète. En streaming,
 * `onToken` est appelé à chaque fragment reçu.
 */
export async function callApi(
  config: ApiConfig,
  messages: ChatMessage[],
  onToken?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      provider: config.provider,
      model: config.model,
      messages,
      stream: config.stream,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Erreur ${res.status} — ${detail || res.statusText}`.trim());
  }

  // ----- Mode non-streaming -----
  if (!config.stream || !res.body) {
    const data = await res.json();
    return config.provider === "ollama"
      ? data?.message?.content ?? JSON.stringify(data)
      : data?.choices?.[0]?.message?.content ?? JSON.stringify(data);
  }

  // ----- Mode streaming : lecture du flux ligne par ligne -----
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const handleDelta = (delta?: string) => {
    if (delta) {
      full += delta;
      onToken?.(delta);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // garde la ligne incomplète

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (config.provider === "ollama") {
        // NDJSON : un objet JSON complet par ligne
        try {
          const json = JSON.parse(trimmed);
          handleDelta(json?.message?.content);
          if (json?.done) return full;
        } catch {
          /* ligne incomplète : ignorée */
        }
      } else {
        // SSE OpenAI : lignes "data: {...}" terminées par "[DONE]"
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return full;
        try {
          const json = JSON.parse(payload);
          handleDelta(json?.choices?.[0]?.delta?.content);
        } catch {
          /* fragment incomplet : complété au prochain chunk */
        }
      }
    }
  }

  return full;
}

/**
 * Liste les modèles disponibles via le proxy (best-effort).
 * Renvoie une liste vide si indisponible.
 */
export async function listModels(config: ApiConfig): Promise<string[]> {
  try {
    const res = await fetch(`/api/models?provider=${config.provider}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (config.provider === "ollama") {
      return (data?.models ?? []).map((m: { name: string }) => m.name);
    }
    return (data?.data ?? []).map((m: { id: string }) => m.id);
  } catch {
    return [];
  }
}
