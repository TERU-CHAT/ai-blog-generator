import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("./")); // index.html, script.js, style.css を公開

// 環境変数（Render の Dashboard → Environment で設定）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ---------------------- タイトル生成 API ----------------------
app.post("/api/titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword is empty" });

    const systemPrompt = `
あなたはSEOに詳しい日本語プロ編集者です。
指定のキーワードを必ず含む魅力的なタイトルを5つ提案してください。
出力は JSON のみ。
{
  "titles": ["...", "...", "...", "...", "..."]
}
`;

    const userPrompt = `キーワード: ${keyword}`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await apiRes.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    return res.json({
      titles: parsed.titles || []
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------------- 記事生成 API ----------------------
app.post("/api/article", async (req, res) => {
  try {
    const { keyword, tone, title } = req.body;
    if (!keyword || !title)
      return res.status(400).json({ error: "keyword or title missing" });

    const systemPrompt = `
あなたはSEO検定1級レベルの日本語ライターです。
指定キーワードで 3000字以上、H2/H3 を含む Markdown 形式の記事を生成してください。
出力は JSON のみ:
{
  "markdown": "記事内容"
}
`;

    const userPrompt = `
キーワード: ${keyword}
タイトル: ${title}
文体: ${tone}
`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await apiRes.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    return res.json({
      markdown: parsed.markdown || ""
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- サーバ起動 ----------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
