import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/* Protège les pages : redirige vers /login si pas de session valide,
 * et de /login vers / si déjà connecté. (jose fonctionne sur l'edge ;
 * pas d'accès DB ici — uniquement la vérification du JWT.) */

function secret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me"
  );
}

async function isValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const valid = await isValid(token);
  const { pathname } = req.nextUrl;

  if (pathname === "/login") {
    if (valid) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!valid) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login"],
};
