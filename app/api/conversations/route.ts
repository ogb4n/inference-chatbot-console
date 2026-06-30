import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

interface ConvRow {
  id: string;
  title: string;
  messages: string;
  created_at: number;
  updated_at: number;
}

const unauthorized = () =>
  NextResponse.json({ error: "Non authentifié" }, { status: 401 });

/** Liste les conversations de l'utilisateur connecté. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const rows = getDb()
    .prepare(
      "SELECT id, title, messages, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC"
    )
    .all(user.userId) as ConvRow[];

  const conversations = rows.map((r) => ({
    id: r.id,
    title: r.title,
    messages: JSON.parse(r.messages),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ conversations });
}

/** Crée ou met à jour une conversation (upsert), restreinte à son propriétaire. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let c: {
    id?: string;
    title?: string;
    messages?: unknown;
    createdAt?: number;
    updatedAt?: number;
  };
  try {
    c = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (!c.id) {
    return NextResponse.json({ error: "id manquant" }, { status: 400 });
  }

  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO conversations (id, user_id, title, messages, created_at, updated_at)
       VALUES (@id, @user_id, @title, @messages, @created_at, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         messages = excluded.messages,
         updated_at = excluded.updated_at
       WHERE conversations.user_id = @user_id`
    )
    .run({
      id: c.id,
      user_id: user.userId,
      title: c.title ?? "Nouvelle conversation",
      messages: JSON.stringify(c.messages ?? []),
      created_at: c.createdAt ?? now,
      updated_at: c.updatedAt ?? now,
    });

  return NextResponse.json({ ok: true });
}

/** Supprime une conversation de l'utilisateur. */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  getDb()
    .prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
    .run(id, user.userId);

  return NextResponse.json({ ok: true });
}
