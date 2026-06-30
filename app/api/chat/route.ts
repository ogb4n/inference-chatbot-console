import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =====================================================================
 *  PROXY D'INFÉRENCE (côté serveur)
 * =====================================================================
 *  Le navigateur appelle CETTE route (même origine -> pas de CORS).
 *  Le serveur ajoute la clé d'API (header X-API-Key, gardée côté
 *  serveur) et relaie vers le serveur d'inférence, puis renvoie le
 *  flux de réponse tel quel (streaming préservé).
 *
 *  Variables d'environnement (runtime) :
 *    INFERENCE_BASE_URL  URL du serveur (défaut: host.docker.internal:11434)
 *    INFERENCE_API_KEY   clé d'API envoyée en header X-API-Key
 * ===================================================================== */

const BASE_URL = (
  process.env.INFERENCE_BASE_URL ?? "http://host.docker.internal:11434"
).replace(/\/+$/, "");
const API_KEY = process.env.INFERENCE_API_KEY ?? "";

export async function POST(req: NextRequest) {
  let body: {
    provider?: "openai" | "ollama";
    model?: string;
    messages?: unknown;
    stream?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Requête JSON invalide", { status: 400 });
  }

  const provider = body.provider ?? "ollama";
  const path =
    provider === "ollama" ? "/api/chat" : "/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Caddy exige X-API-Key ; on ajoute aussi Authorization au cas où
  // le serveur maison attendrait un Bearer.
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        stream: body.stream ?? true,
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return new Response(
      `Le serveur ne peut pas joindre ${BASE_URL} — ${detail}`,
      { status: 502 }
    );
  }

  // Relaie le flux brut (NDJSON Ollama ou SSE OpenAI) sans le bufferiser.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
