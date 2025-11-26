import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ---- JSON 抽出 ----
function extractJSONFromText(text) {
  if (!text) return null;
  text = text.replace(/```json|```/g, "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    try {
      const cleaned = match[0].replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]");
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

// ---- タイトル生成 API（元コード維持） ----
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword is empty" });

    const systemPrompt = `
あなたはSEO検定1級レベルの日本語プロ編集者です。
以下の形式のみで返してください：
{
  "titles": ["タイトルA", "タイトルB", "タイトルC", "タイトルD", "タイトルE"]
}
必ず5件出力すること。`;

    const userPrompt = `キーワード: ${keyword}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.8,
      }),
    });

    const apiData = await response.json();
    const raw = apiData.choices?.[0]?.message?.content || "";
    const parsed = extractJSONFromText(raw);

    if (!parsed || !parsed.titles) {
      const fallback = raw
        .split(/\r?\n/)
        .map(s => s.replace(/^[0-9\.\-\)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
      return res.json({ titles: fallback });
    }

    res.json({ titles: parsed.titles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// ---- 記事生成（まとめ必須・15000トークン） ----
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title) return res.status(400).json({ error: "title is empty" });
    if (!keyword) return res.status(400).json({ error: "keyword is empty" });

    const systemPrompt = `
あなたはSEO検定1級レベルのプロライターです。
以下の厳密な形式で JSON のみ出力してください：
{
  "html": "...",
  "text": "..."
}

【構成ルール】
1) H1は与えられたタイトルを必ず使用
2) H2を5個以上
3) 各H2配下にH3を2個以上
4) 各H3本文は300文字以上
5) 導入500文字以上
6) 記事全体3000文字以上
7) 1文ごとに改行
8) H2/H3はHTMLタグで出力
9) プレーンテキストは「## H2:〜」「### H3:〜」形式

【重要】
11) 最後に必ず <h2>まとめ</h2> を作成し、500文字以上で締めること。
12) まとめは絶対に省略してはならない。

余計な説明文は禁止。
`;

    const userPrompt = `タイトル: ${title}
キーワード: ${keyword}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 15000
      }),
    });

    const apiData = await response.json();
    const raw = apiData.choices?.[0]?.message?.content || "";
    const parsed = extractJSONFromText(raw);

    if (!parsed) {
      return res.json({
        html: raw,
        text: raw.replace(/<[^>]*>/g, "")
      });
    }

    res.json({
      html: parsed.html || "",
      text: parsed.text || ""
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
