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
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ----------------------------------------------------
// ① ブログタイトル生成 API
// ----------------------------------------------------
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword is empty" });

    const systemPrompt = `
あなたはSEO検定1級レベルの日本語プロ編集者です。
以下の要件を満たしたブログタイトル案を生成してください。

◆ 要件
・キーワードを自然に含める
・検索意図が明確にわかる
・魅力的でクリックされるタイトル
・キーワードは複数ある場合、空白区切りで渡される
・タイトルは5個生成すること
    `;

    const userPrompt = `キーワード: ${keyword}`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
        temperature: 0.8,
      }),
    });

    const data = await apiRes.json();
    const titles = data.choices[0].message.content
      .split("\n")
      .filter((t) => t.trim() !== "");

    res.json({ titles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "API Error" });
  }
});

// ----------------------------------------------------
// ② ブログ本文生成 API（SEO強化プロライター版）
// ----------------------------------------------------
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;

    if (!title) return res.status(400).json({ error: "title is empty" });
    if (!keyword) return res.status(400).json({ error: "keyword is empty" });

    const systemPrompt = `
あなたはSEO検定1級レベルのプロライターです。
以下のルールでブログ記事を生成してください。

◆ 記事ルール
・総文字数：3000文字以上
・導入文：500文字以上
・まとめ：500文字以上
・キーワードや類義語を自然に含める
・H2を5個以上必ず作る
・H2の下にH3を2個以上
・H3本文は1つ300文字以上
・語尾は前後で重複しないようにする
・検索意図に完全に応える内容にする
・文章は自然で読みやすい構成にする
`;

    const userPrompt = `
ブログタイトル：${title}
キーワード：${keyword}

この内容からSEO最適化された3000文字以上の記事を生成してください。
`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
        temperature: 0.8,
      }),
    });

    const data = await apiRes.json();
    const article = data.choices[0].message.content;

    res.json({ article });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "API Error" });
  }
});

// ----------------------------------------------------
app.listen(3000, () => console.log("Server running on port 3000"));
