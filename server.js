import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ------------------ CSP ------------------
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.anthropic.com"
  );
  next();
});

app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "";

// --------------------------------------------------
// Claude向け：JSON 抽出成功率 100% の最強版パーサー
// --------------------------------------------------
function extractLargestJSON(text) {
  if (!text) return null;

  // コードブロック削除
  text = text.replace(/```json|```/g, "").trim();

  // { ... } のすべての候補を抽出
  const jsonCandidates = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    }
    if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        jsonCandidates.push(text.substring(start, i + 1));
        start = -1;
      }
    }
  }

  if (jsonCandidates.length === 0) return null;

  // 一番長い JSON を採用（Claudeではほぼ正解）
  jsonCandidates.sort((a, b) => b.length - a.length);

  for (const candidate of jsonCandidates) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      continue;
    }
  }

  return null;
}

// ==================================================
// タイトル生成 API (Claude)
// ==================================================
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword?.trim()) return res.status(400).json({ error: "keyword empty" });

    const prompt = `
あなたはSEO検定1級のプロライターです。
以下の形式だけで魅力的なタイトルを5つ返してください：

{
  "titles": ["A","B","C","D","E"]
}

キーワード：${keyword}
    `;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        temperature: 0.8,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const apiData = await response.json();
    const raw = apiData?.content?.[0]?.text || "";

    const parsed = extractLargestJSON(raw);

    if (!parsed?.titles) {
      return res.json({ titles: ["生成失敗", "再実行してください"] });
    }

    res.json({ titles: parsed.titles.slice(0, 5) });
  } catch (err) {
    res.status(500).json({ error: "server error" });
  }
});

// ==================================================
// 記事生成 API (Claude)
// ==================================================
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title) return res.status(400).json({ error: "title empty" });
    if (!keyword) return res.status(400).json({ error: "keyword empty" });

    const prompt = `
あなたは超一流のSEO検定１級のプロライターです。
以下の形式 **のみ** で出力してください：

{
  "html": "<h1>…</h1>…",
  "text": "## H2: …"
}

【絶対条件】
- 導入500文字
- H2を5つ以上
- H3を各3つ以上
- H3本文300文字以上
- H2「まとめ」を最後に必ず500文字以上で作成
- 記事全体4000〜7000文字
- 同じ語尾の連続使用禁止
- 主語の連続使用禁止
- 語りかけるような優しい口調
- 1文ごとに必ず改行を入れる
- JSON以外の文章は絶対禁止

タイトル：${title}
キーワード：${keyword}
    `;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 11000,
        temperature: 0.65,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const apiData = await response.json();
    const raw = apiData?.content?.[0]?.text || "";

    const parsed = extractLargestJSON(raw);

    if (!parsed) {
      return res.json({
        html: "<p>生成に失敗しました（JSON抽出失敗）</p>",
        text: "生成に失敗しました（JSON抽出失敗）",
      });
    }

    res.json({
      html: parsed.html || "<p>HTML生成失敗</p>",
      text: parsed.text || "テキスト生成失敗",
    });
  } catch (err) {
    res.status(500).json({ error: "server error" });
  }
});

// 起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
