// Encrypt the pages with a password. Usage: TT_PASSWORD=xxx node build.mjs
import { webcrypto as wc } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const PLAIN = process.env.PLAIN === "1";   // PLAIN=1 publishes the pages without the password gate
const pw = process.env.TT_PASSWORD; if (!pw && !PLAIN) { console.error("set TT_PASSWORD"); process.exit(1); }
const enc = new TextEncoder();
const salt = wc.getRandomValues(new Uint8Array(16));
const base = PLAIN ? null : await wc.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
const key = PLAIN ? null : await wc.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const b64 = (u8) => Buffer.from(u8).toString("base64");
mkdirSync("enc", { recursive: true }); mkdirSync("play", { recursive: true });
const loader = readFileSync("src/_loader.html", "utf8");
const pages = [
  { name: "index", src: "src/index.html", out: "index.html", enc: "enc/index.json" },
  { name: "workflow", src: "src/workflow.html", out: "workflow.html", enc: "enc/workflow.json" },
  { name: "play", src: "src/play/index.html", out: "play/index.html", enc: "../enc/play.json" },
];
for (const p of pages) {
  const html = readFileSync(p.src, "utf8");
  if (PLAIN) { writeFileSync(p.out, html); console.log("plain", p.name, html.length); continue; }
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(html)));
  writeFileSync(`enc/${p.name}.json`, JSON.stringify({ salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
  const title = (html.match(/<title>(.*?)<\/title>/) || [, "Effect Platform Test"])[1];
  writeFileSync(p.out, loader.replace(/__ENC__/g, p.enc).replace(/__TITLE__/g, title));
  console.log("encrypted", p.name, ct.length);
}
