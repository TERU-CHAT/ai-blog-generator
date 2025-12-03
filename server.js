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
    "default-src 'self'; " +
      "img-src 'self' data:; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; " +
      "script-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' https://api.anthropic.com"
  );
  next();
});

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Claude API key
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "";

// ------------------------
// JSON 抽出ユーティリティ
// ------------------------
function extractJSONFromText(text) {
  if (!text) return null;
  text = text.replace(/```json|```/g, "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    const cleaned = match[0]
      .replace(/,\s*}/g, "}")
      .replace(/,\s*\]/g, "]");
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      return null;
    }
  }
}

// ------------------------------------------------------
// タイトル生成 API（Claude Sonnet 4 仕様）
// ------------------------------------------------------
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword?.trim()) {
      return res.status(400).json({ error: "keyword is empty" });
    }

    const systemPrompt = `
あなたはSEO検定1級レベルの日本語プロ編集者です。
以下の条件に従って、キーワード（空白区切り）を必ず含む魅力的なブログタイトルを **ちょうど5件** JSON だけで返してください。

形式：
{
  "titles": ["タイトルA", "タイトルB", "タイトルC", "タイトルD", "タイトルE"]
}

条件:
- キーワードは自然に含める。
- 番号は付けない。
- 検索意図を満たしたクリックされやすい内容。
- 不要な解説は絶対に出力しない。
`;

    const userPrompt = `キーワード: ${keyword}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        temperature: 0.8,
        messages: [
          { role: "user", content: systemPrompt + "\n" + userPrompt }
        ]
      }),
    });

    const apiData = await response.json();
    const raw = apiData?.content?.[0]?.text || "";

    const parsed = extractJSONFromText(raw);

    if (!parsed || !Array.isArray(parsed.titles)) {
      const fallback = raw
        .split(/\r?\n/)
        .map((s) => s.replace(/^[0-9\.\-\)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
      return res.json({ titles: fallback });
    }

    res.json({ titles: parsed.titles.slice(0, 5) });

  } catch (err) {
    console.error("generate-titles error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// ------------------------------------------------------
// 記事生成 API（Claude Sonnet 4）
// ------------------------------------------------------
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "title is empty" });
    if (!keyword?.trim()) return res.status(400).json({ error: "keyword is empty" });

    const systemPrompt = `
あなたはSEO検定1級レベルのプロライターです。
以下のルールに従って、日本語のSEOブログ記事を生成してください。

【出力形式（必須）】
JSON のみを返す。
余計な説明文は絶対に禁止。

{
  "html": "<h1>...</h1>...",
  "text": "## H2: ...\n本文..."
}

【構成ルール】
1) H1 は指定タイトルを使用。
2) H2 を5個以上、キーワードや類義語を自然に含める。
3) 各H2 の下に H3 を3個以上。
4) 各H3 本文は300文字以上。
5) 導入文は500文字以上。
6) 記事全体は4000文字以上。
7) 1文ごとに改行する。
8) 語尾の連続「です。」「です。」は禁止。
9) 語尾バリエーションを自然に使用（〜ですよ、〜なんです、〜といえます等）。
10) 主語の連続も禁止し、自然で読みやすい文体にする。
11) <h2><h3> の上下に1行改行を必ず入れる。
12) 最後に H2「まとめ」を用意し500文字以上。
13) HTML と text の内容は同一にする。

【注意】
- JSON 以外の出力は禁止。
`;

    const userPrompt = `タイトル: ${title}
キーワード: ${keyword}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 15000,
        temperature: 0.6,
        messages: [
          { role: "user", content: systemPrompt + "\n" + userPrompt }
        ]
      }),
    });

    const apiData = await response.json();
    const raw = apiData?.content?.[0]?.text || "";
    const parsed = extractJSONFromText(raw);

    if (!parsed) {
      return res.json({ html: "", text: raw });
    }

    res.json({
      html: parsed.html || "",
      text: parsed.text || ""
    });

  } catch (err) {
    console.error("generate-article error:", err);
    res.status(500).json({ error: "server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
