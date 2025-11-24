// =====================
// server.js（完全リセット版）
// =====================
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
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

function extractJSONFromText(text) {
  if (!text) return null;
  text = text.replace(/```json|```/g, "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch(e) {
    const cleaned = match[0].replace(/,\s*}/g,"}").replace(/,\s*\]/g,"]");
    try { return JSON.parse(cleaned); } catch(e2) { return null; }
  }
}

// タイトル生成
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword?.trim()) return res.status(400).json({ error: "keyword empty" });

    const systemPrompt = `あなたはSEO検定1級レベルの日本語プロ編集者です。キーワードを必ず含む魅力的なタイトルを5件 JSON 形式で出力してください。`;

    const userPrompt = `キーワード: ${keyword}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {"Content-Type":"application/json", Authorization:`Bearer ${OPENAI_API_KEY}`},
      body: JSON.stringify({ model:"gpt-4o", messages:[{role:"system",content:systemPrompt},{role:"user",content:userPrompt}], temperature:0.8, max_tokens:600 })
    });

    const apiData = await response.json();
    const raw = apiData.choices?.[0]?.message?.content || apiData.choices?.[0]?.text || "";
    const parsed = extractJSONFromText(raw);

    let titles = parsed?.titles || raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,5);
    while (titles.length < 5) titles.push("");

    res.json({ titles });
  } catch(err) {
    console.error("generate-titles error:", err);
    res.status(500).json({ titles: [] });
  }
});

// 記事生成
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title?.trim() || !keyword?.trim()) return res.status(400).json({ error: "title or keyword empty" });

    const systemPrompt = `あなたはSEO検定1級レベルのプロライターです。HTMLとtextを必ず出力してください。text内の見出しは「## H2: 見出し」「### H3: 見出し」としてください。文章は3000文字以上で、H2は5個以上、H3は各2個以上、各H3本文は300文字以上です。`;

    const userPrompt = `タイトル: ${title}\nキーワード: ${keyword}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {"Content-Type":"application/json", Authorization:`Bearer ${OPENAI_API_KEY}`},
      body: JSON.stringify({ model:"gpt-4o", messages:[{role:"system",content:systemPrompt},{role:"user",content:userPrompt}], temperature:0.7, max_tokens:4500 })
    });

    const apiData = await response.json();
    const raw = apiData.choices?.[0]?.message?.content || apiData.choices?.[0]?.text || "";
    const parsed = extractJSONFromText(raw);

    let html = parsed?.html;
    if (!html && parsed?.text) html = parsed.text.replace(/\n/g,"<br>");

    res.json({ html: html || raw, text: parsed?.text || raw });

  } catch(err) {
    console.error("generate-article error:", err);
    res.status(500).json({ html: `サーバーエラーが発生しました: ${err.message}`, text: '' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
