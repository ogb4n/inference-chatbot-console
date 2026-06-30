import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome : produit .next/standalone, idéal pour une image Docker légère
  output: "standalone",
};

export default nextConfig;
