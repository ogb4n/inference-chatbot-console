/* =====================================================================
 *  CONFIGURATION DU SERVEUR D'INFÉRENCE
 * =====================================================================
 *  Modifiable directement depuis l'interface (panneau Réglages) et
 *  persistée dans le localStorage. Aucun changement de code requis
 *  pour brancher le serveur fourni par l'équipe INFRA.
 * ===================================================================== */

/** Format de l'API exposée par le serveur d'inférence. */
export type Provider = "openai" | "ollama";

export interface ApiConfig {
  /** "openai" = endpoint OpenAI-compatible (Triton, Ollama /v1, serveur maison)
   *  "ollama" = API native Ollama (/api/chat) */
  provider: Provider;
  /** URL de base du serveur, sans le chemin (ex: http://localhost:11434) */
  baseUrl: string;
  /** Nom du modèle à interroger (ex: llama3, mistral, ...) */
  model: string;
  /** Clé API optionnelle (Bearer) — vide pour Ollama/Triton en local */
  apiKey: string;
  /** Affichage progressif token par token */
  stream: boolean;
}

/** Réglages par défaut (Ollama local). */
export const DEFAULT_CONFIG: ApiConfig = {
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3",
  apiKey: "",
  stream: true,
};

/** Presets rapides correspondant aux serveurs proposés par l'équipe INFRA. */
export const PRESETS: { label: string; config: Partial<ApiConfig> }[] = [
  {
    label: "Ollama",
    config: { provider: "ollama", baseUrl: "http://localhost:11434" },
  },
  {
    label: "Triton",
    config: { provider: "openai", baseUrl: "http://localhost:8000" },
  },
];

/** Construit l'URL complète de l'endpoint selon le provider. */
export function resolveEndpoint(config: ApiConfig): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  return config.provider === "ollama"
    ? `${base}/api/chat`
    : `${base}/v1/chat/completions`;
}

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
