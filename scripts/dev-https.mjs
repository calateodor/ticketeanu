// Server de dezvoltare pe HTTPS, pentru testat pe telefon (înclinarea biletului cere HTTPS).
// Rulează alături de `npm run dev`: port 3001, build separat (.next-https), fără cron (îl ține serverul de pe 3000).
// Certificatul e local, în certificates/ (generat cu openssl, nu instalat în sistem):
//   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 -keyout certificates/dev-key.pem -out certificates/dev-cert.pem \
//     -subj "/CN=Ticketeanu dev" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:<IP-ul tău din rețea>"
// Pe telefon, browserul avertizează o dată că certificatul nu e de încredere: „Continuă” / „Vizitează site-ul”.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const key = "certificates/dev-key.pem";
const cert = "certificates/dev-cert.pem";
if (!existsSync(key) || !existsSync(cert)) {
  console.error(`Lipsește certificatul (${cert}, ${key}). Vezi comanda openssl din scripts/dev-https.mjs.`);
  process.exit(1);
}

const child = spawn("npx", ["next", "dev", "-p", "3001", "-H", "0.0.0.0", "--experimental-https", "--experimental-https-key", key, "--experimental-https-cert", cert], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-https", INPROCESS_CRON: "0" },
});
child.on("exit", (code) => process.exit(code ?? 0));
