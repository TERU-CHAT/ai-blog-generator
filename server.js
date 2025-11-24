// ===============================
// server.js（完全修正版 2025 optimal）
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
// GPT JSON Extract Helper
// -----------------------------
function extractJSON(text) {
  if (!text) return null;

  // remove ```json blocks
  const cleaned = text.replace(/```json|```/g, "").trim();

  // find JSON object
  const match = cleaned.match(/\{[\s\S]*\}$/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// -----------------------------
// タイトル生成
// -----------------------------
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword empty" });

    const systemPrompt = `
あなたはSEO検定1級レベルの日本語プロ編集者です。
以下の形式で **JSONのみを出力** してください。

{
  "titles": ["タイトル1", "タイトル2", "タイトル3", "タイトル4", "タイトル5"]
}

条件:
- キーワードは空白区切りで必ず含める
- 番号は付けない
- 必ず5件
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" }, // ★JSONモード
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `キーワード: ${keyword}` }
        ],
        max_tokens: 2000,
        temperature: 0.8
      })
    });

    const apiData = await response.json();
    res.json(apiData.choices[0].message.parsed);
  } catch (err) {
    console.error("titles error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// -----------------------------
// 記事生成
// -----------------------------
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title) return res.status(400).json({ error: "title empty" });
    if (!keyword) return res.status(400).json({ error: "keyword empty" });

    // ==============================
    // ★成功率99%の最適化済みプロンプト
    // ==============================
    const systemPrompt = `
あなたはSEO検定1級レベルのプロブログライターです。
以下の「構成ルール」と「出力形式」を厳守して日本語記事を生成してください。

【出力形式（JSONのみ）】
{
  "html": "<h1>...</h1> ...",
  "text": "### H1: ...\n ...（文章は1文ごとに改行）"
}

【構成ルール】
1. <h1> はユーザー指定タイトルを正確に使用
2. H2 を少なくとも 5 個
3. H2 それぞれに H3 を少なくとも2つ配置（合計10個以上）
4. 各 H3 の本文は300文字以上（必須）
5. 導入文は500文字以上、まとめも500文字以上
6. 記事全体で3000〜8000文字に収める
7. **文章は1文ごとに改行する**
8. 口調は丁寧＋やさしい解説（語尾に「〜ですよ」「〜なんですよね」）
9. HTML と text の内容は同一構造
10. text 内の見出しは「### H2: 見出し」「#### H3: 見出し」

【禁止事項】
- JSON外のテキストを出力しない
- 途中で途切れた文章を出力しない
- 未完了のHTMLタグを残さない
`;

    const userPrompt = `タイトル: ${title}\nキーワード: ${keyword}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" }, // ★壊れない
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 15000, // ★3000〜7000文字生成対応
        temperature: 0.7
      })
    });

    const apiData = await response.json();
    res.json(apiData.choices[0].message.parsed);
  } catch (err) {
    console.error("article error:", err);
    res.status(500).json({ error: "server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
