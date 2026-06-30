import type { ChatMessage } from "./types";

/* =====================================================================
 *  STOCKAGE DES CONVERSATIONS (localStorage)
 * =====================================================================
 *  Historique multi-conversations : chaque conversation conserve ses
 *  messages, un titre (déduit du 1er message) et ses horodatages.
 * ===================================================================== */

export interface StoredMessage extends ChatMessage {
  /** vrai pendant la réception du flux (transitoire) */
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "inference-console-conversations";

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Conversation[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveConversations(list: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

/** Identifiant unique (avec repli si crypto.randomUUID indisponible). */
function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function newConversation(): Conversation {
  const now = Date.now();
  return {
    id: uid(),
    title: "Nouvelle conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Titre déduit du premier message utilisateur. */
export function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "Nouvelle conversation";
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean;
}

/** Conversations triées de la plus récente à la plus ancienne. */
export function sortByRecent(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}
