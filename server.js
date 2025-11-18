import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

// 静的ファイルを配信
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// =========================
// 1. タイトル生成 API
// =========================
app.post("/api/titles", async (req, res) => {
  const { keyword } = req.body || {};
  if (!keyword) return res.status(400).json({ error: "keyword is empty" });

  try {
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "キーワードから自然なタイトルを5つ生成するAIです。" },
          { role: "user", content: `キーワード: ${keyword}` }
        ]
      }),
    });

    const data = await apiRes.json();

    let parsed = {};
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch {
      return res.status(500).json({ error: "Failed to parse titles" });
    }

    res.json({ titles: parsed.titles || [] });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// 2. 記事生成 API
// =========================
app.post("/api/article", async (req, res) => {
  const { keyword, tone, title } = req.body || {};
  if (!keyword || !title)
    return res.status(400).json({ error: "keyword/title missing" });

  try {
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "SEO記事をMarkdownで生成するAIです。" },
          { role: "user", content: `キーワード: ${keyword}\nタイトル: ${title}\nTone: ${tone}` }
        ]
      }),
    });

    const data = await apiRes.json();

    let parsed = {};
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch {
      return res.status(500).json({ error: "Failed to parse article" });
    }

    res.json({
      markdown: parsed.markdown || "",
      html: parsed.html || ""
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Render のポートで起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
