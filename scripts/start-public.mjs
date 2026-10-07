// Versiunea de producție, pentru văzut site-ul de pe telefon de oriunde (prin ngrok).
// Folosește build-ul din .next-build (NEXT_DIST_DIR=.next-build npx next build), port 3002, fără cron
// (îl ține serverul de dev). În producție nu apar codul de login pe ecran și /dev/emails.
//   node scripts/start-public.mjs        apoi: ngrok http 3002
// Adresa ngrok (opțional, primul argument sau PUBLIC_URL), ca linkurile din QR să ducă acolo, nu la localhost.
import { spawn } from "node:child_process";

const publicUrl = process.argv[2] ?? process.env.PUBLIC_URL;

const child = spawn("npx", ["next", "start", "-p", "3002"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next-build",
    INPROCESS_CRON: "0",
    ...(publicUrl ? { NEXT_PUBLIC_SITE_URL: publicUrl } : {}),
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
