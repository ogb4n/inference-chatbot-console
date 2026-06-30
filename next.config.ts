import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome : produit .next/standalone, idéal pour une image Docker légère
  output: "standalone",
  // better-sqlite3 est un module natif : on le garde hors du bundle serveur
  // pour qu'il soit chargé depuis node_modules au runtime.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
