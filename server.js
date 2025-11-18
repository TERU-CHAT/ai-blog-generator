import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 静的ファイル（フロント）
app.use(express.static("public"));

// 環境変数（Render で必ず設定）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// -----------------------------
// タイトル生成 API
// -----------------------------
app.post("/api/titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword is empty" });

    const systemPrompt = `
あなたはSEOに詳しい日本語のプロ編集者です。
指定キーワードを必ず含む魅力的なタイトルを5つ生成してください。
出力は次の形式の JSON のみ：
{ "titles": ["...", "...", "...", "...", "..."] }
`;

    const userPrompt = `キーワード：${keyword}`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8
      })
    });

    const data = await apiRes.json();

    let raw = data.choices?.[0]?.message?.content || "{}";

    // JSON以外が混ざってたら抽出
    raw = raw.trim().replace(/```json/g, "").replace(/```/g, "");

    const parsed = JSON.parse(raw);

    return res.json({ titles: parsed.titles || [] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 記事生成 API
// -----------------------------
app.post("/api/article", async (req, res) => {
  try {
    const { keyword, tone, title } = req.body;
    if (!keyword || !title)
      return res.status(400).json({ error: "keyword or title missing" });

    const systemPrompt = `
あなたはSEO検定1級レベルの日本語ライターです。
指定キーワードで 3000字以上、Markdown形式で記事を作成してください。
出力は次の形式の JSON のみ：
{ "markdown": "記事内容" }
`;

    const userPrompt = `
キーワード: ${keyword}
タイトル: ${title}
文体: ${tone}
`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    const data = await apiRes.json();

    let raw = data.choices?.[0]?.message?.content || "{}";
    raw = raw.trim().replace(/```json/g, "").replace(/```/g, "");

    const parsed = JSON.parse(raw);

    return res.json({
      markdown: parsed.markdown || ""
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// サーバー起動
// -----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
