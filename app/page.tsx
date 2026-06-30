import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Chat from "@/components/Chat";

// Contrôle d'accès côté serveur (runtime Node = lit AUTH_SECRET au runtime).
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <Chat />;
}
