import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverul HTTPS de test (scripts/dev-https.mjs) are build-ul lui, ca să poată rula alături de `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Telefonul din aceeași rețea poate încărca resursele de dezvoltare (IP-ul din certificat).
  allowedDevOrigins: ["192.168.100.105"],
};

export default nextConfig;
