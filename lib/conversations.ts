import type { ChatMessage } from "./types";

/* =====================================================================
 *  CONVERSATIONS (API serveur, liées au compte utilisateur)
 * =====================================================================
 *  Les conversations sont stockées côté serveur (SQLite) et accessibles
 *  via /api/conversations. Synchronisées entre appareils.
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

/* ---------- Helpers purs ---------- */

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

export function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "Nouvelle conversation";
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean;
}

export function sortByRecent(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ---------- Accès API ---------- */

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/conversations");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.conversations ?? []) as Conversation[];
}

export async function upsertConversation(c: Conversation): Promise<void> {
  await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  });
}

export async function deleteConversationApi(id: string): Promise<void> {
  await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
