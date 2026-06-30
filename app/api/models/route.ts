import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Liste des modèles disponibles, relayée via le proxy (avec clé d'API). */

const BASE_URL = (
  process.env.INFERENCE_BASE_URL ?? "http://host.docker.internal:11434"
).replace(/\/+$/, "");
const API_KEY = process.env.INFERENCE_API_KEY ?? "";

export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return new Response("Non authentifié", { status: 401 });
  }

  const provider = req.nextUrl.searchParams.get("provider") ?? "ollama";
  const path = provider === "ollama" ? "/api/tags" : "/v1/models";

  const headers: Record<string, string> = {};
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  try {
    const upstream = await fetch(`${BASE_URL}${path}`, { headers });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: detail }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
