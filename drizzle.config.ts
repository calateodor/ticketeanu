import { defineConfig } from "drizzle-kit";

// Local: fișierul din data/. Pe Vercel, integrarea Turso pune TURSO_DATABASE_URL și TURSO_AUTH_TOKEN.
export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:./data/ticketeanu.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined,
  },
});
