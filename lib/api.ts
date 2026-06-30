import type { ChatMessage } from "./types";
import { type ApiConfig, resolveEndpoint } from "./config";

/* =====================================================================
 *  COUCHE API — intégration temps réel avec le serveur d'inférence
 * =====================================================================
 *  Supporte deux protocoles :
 *   - "openai"  : OpenAI Chat Completions, streaming SSE (`data: ...`)
 *                 → Triton, Ollama (/v1), serveur maison compatible
 *   - "ollama"  : API native Ollama (/api/chat), streaming NDJSON
 * ===================================================================== */

/**
 * Envoie la conversation au serveur d'inférence et renvoie la réponse
 * complète. En streaming, `onToken` est appelé à chaque fragment reçu.
 *
 * @param config    réglages du serveur (provider, url, modèle, clé)
 * @param messages  historique complet (rôle + contenu)
 * @param onToken   callback appelé à chaque fragment en streaming
 * @param signal    AbortSignal optionnel pour annuler la requête
 */
export async function callApi(
  config: ApiConfig,
  messages: ChatMessage[],
  onToken?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const res = await fetch(resolveEndpoint(config), {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: config.stream,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText} ${detail}`.trim());
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
 * Liste les modèles disponibles sur le serveur (best-effort).
 * Renvoie une liste vide si l'endpoint n'est pas supporté.
 */
export async function listModels(config: ApiConfig): Promise<string[]> {
  const base = config.baseUrl.replace(/\/+$/, "");
  const url =
    config.provider === "ollama" ? `${base}/api/tags` : `${base}/v1/models`;
  const headers: Record<string, string> = {};
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  try {
    const res = await fetch(url, { headers });
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
