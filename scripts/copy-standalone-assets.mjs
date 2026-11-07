// Next's standalone output doesn't include static assets; copy them so
// `node .next/standalone/server.js` can serve CSS/JS (and public/ if present).
import { cpSync, existsSync } from "node:fs";

const copies = [
  [".next/static", ".next/standalone/.next/static"],
  ["public", ".next/standalone/public"],
];

for (const [from, to] of copies) {
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
    console.log(`copied ${from} -> ${to}`);
  }
}
