// ===============================
// server.js（完全修正版・SEO特化プロンプト対応）
// ===============================

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// -----------------------------
// Content Security Policy
// -----------------------------
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "img-src 'self' data:; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; " +
      "script-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' https://api.openai.com"
  );
  next();
});

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// -----------------------------
// JSON抽出ヘルパー
// -----------------------------
function extractJSON(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}$/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// -----------------------------
// タイトル生成 API
// -----------------------------
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword empty" });

    const systemPrompt = `あなたはSEO検定1級レベルの日本語プロ編集者です。\n` +
      `以下の形式でJSONのみを出力してください。\n` +
      `{ "titles": ["タイトル1", "タイトル2", "タイトル3", "タイトル4", "タイトル5"] }\n` +
      `キーワードを必ず含め、番号は付けないこと。`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `キーワード: ${keyword}` }
        ],
        max_tokens: 2000,
        temperature: 0.8
      })
    });

    const apiData = await response.json();
    const parsed = extractJSON(apiData.choices?.[0]?.message?.content || "");
    if (!parsed?.titles) return res.json({ titles: [] });

    res.json(parsed);
  } catch (err) {
    console.error("titles error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// -----------------------------
// 記事生成 API
// -----------------------------
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title) return res.status(400).json({ error: "title empty" });
    if (!keyword) return res.status(400).json({ error: "keyword empty" });

    const systemPrompt = `SEO特化ブログ記事生成プロンプト（成功率99%版）`; // 別ファイルのプロンプトをここで使用

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `タイトル: ${title}\nキーワード: ${keyword}` }
        ],
        max_tokens: 15000,
        temperature: 0.7
      })
    });

    const apiData = await response.json();
    const parsed = extractJSON(apiData.choices?.[0]?.message?.content || "");

    if (!parsed?.html || !parsed?.text) return res.json({ html: "", text: apiData.choices?.[0]?.message?.content || "" });

    res.json(parsed);
  } catch (err) {
    console.error("article error:", err);
    res.status(500).json({ error: "server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
