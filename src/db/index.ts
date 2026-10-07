import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function makeClient(): Client {
  const url =
    process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:./data/ticketeanu.db";
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined,
  });
  if (url.startsWith("file:")) {
    // Fișier local: WAL pentru citiri paralele, chei străine pornite.
    void client.executeMultiple(
      "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
    );
  }
  return client;
}

function makeDb() {
  const client = makeClient();
  return drizzle({ client, schema });
}

// În dev, Next reîncarcă modulele; păstrăm o singură conexiune pe proces.
const globalForDb = globalThis as unknown as {
  __ticketeanuDb?: ReturnType<typeof makeDb>;
};

export const db = globalForDb.__ticketeanuDb ?? makeDb();
if (process.env.NODE_ENV !== "production") globalForDb.__ticketeanuDb = db;

export type Db = typeof db;
// O tranzacție deschisă; funcțiile din lib acceptă fie conexiunea, fie o tranzacție.
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Dbx = Db | Tx;
export { schema };
