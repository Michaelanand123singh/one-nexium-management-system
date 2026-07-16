#!/usr/bin/env node
/**
 * Test Gemini API key (AI Terminal). Loads .env from project root, then calls Gemini with a sample prompt.
 * Run: node scripts/test-gemini.mjs   (from repo root)
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY or GOOGLE_API_KEY in .env");
  process.exit(1);
}

const systemPrompt = `You are a CLI assistant. Output exactly ONE shell command. No markdown, no explanation.
Safe commands only: aws, docker ps/logs, tail, ls, pwd, echo, etc.`;

const testPrompt = "list my S3 buckets";

console.log("Testing Gemini API...");
console.log("Model:", model);
console.log("Prompt:", testPrompt);
console.log("");

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: testPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 256, temperature: 0.2 },
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error("Gemini API error:", res.status, JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) {
    console.error("No text in response:", JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log("OK – Gemini API is working.");
  console.log("Suggested command:", text);
} catch (e) {
  console.error("Request failed:", e.message);
  process.exit(1);
}
