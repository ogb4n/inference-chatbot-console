/* =====================================================================
 *  CONFIGURATION CLIENT (interface)
 * =====================================================================
 *  L'URL du serveur d'inférence et la clé d'API sont gérées CÔTÉ SERVEUR
 *  (variables d'environnement INFERENCE_BASE_URL / INFERENCE_API_KEY,
 *  voir app/api/chat/route.ts). Le navigateur ne voit que ces réglages.
 * ===================================================================== */

/** Format de l'API exposée par le serveur d'inférence. */
export type Provider = "openai" | "ollama";

export interface ApiConfig {
  /** "ollama" = /api/chat (NDJSON) — "openai" = /v1/chat/completions (SSE) */
  provider: Provider;
  /** Nom du modèle à interroger (ex: phi3.5, llama3, mistral, ...) */
  model: string;
  /** Affichage progressif token par token */
  stream: boolean;
}

/** Réglages par défaut. */
export const DEFAULT_CONFIG: ApiConfig = {
  provider: "ollama",
  model: "phi3.5",
  stream: true,
};

const STORAGE_KEY = "inference-console-config";

export function loadConfig(): ApiConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<ApiConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: ApiConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* quota / mode privé : on ignore */
  }
}
