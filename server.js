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
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Claude API KEY
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "";

// --------------------------------------------------
// JSON を最も確実に抽出する強化版関数
// Claude は前後に文章が出がちなので、強制で最大 JSON を抽出
// --------------------------------------------------
function extractJSONFromText(text) {
  if (!text) return null;

  // コードブロックの除去
  text = text.replace(/```json|```/g, "").trim();

  // 最初の { と 最後の } を見つける
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const jsonString = text.substring(start, end + 1);

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // , の後に余計な改行が入るなどの補正
    const cleaned = jsonString
      .replace(/,\s*}/g, "}")
      .replace(/,\s*\]/g, "]");
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error("JSON parse failed:", e2);
      return null;
    }
  }
}

// ==================================================
//  タイトル生成 API（Claude Sonnet 4）
// ==================================================
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword?.trim()) {
      return res.status(400).json({ error: "keyword is empty" });
    }

    const prompt = `
あなたはSEO検定1級レベルの日本語プロ編集者です。
以下の条件に従い、キーワードを自然に含めたブログタイトルを **5件だけ** JSON 形式で返してください。

必ず以下の形式のみを出力すること：

{
  "titles": ["タイトルA", "タイトルB", "タイトルC", "タイトルD", "タイトルE"]
}

● 注意
- JSON 以外の文章を一切書かない。
- タイトルの前に番号を付けない。
- クリック率が高くなるような自然で魅力的なタイトル。
- 余計な説明は絶対に禁止。

キーワード：${keyword}
`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        temperature: 0.8,
        messages: [
          { role: "user", content: prompt }
        ]
      }),
    });

    const apiData = await response.json();
    const raw = apiData?.content?.[0]?.text || "";

    const parsed = extractJSONFromText(raw);

    if (!parsed || !Array.isArray(parsed.titles)) {
      return res.json({
        titles: ["生成に失敗しました", "キーワードを変えて再実行してください"]
      });
    }

    res.json({ titles: parsed.titles.slice(0, 5) });

  } catch (err) {
    console.error("generate-titles error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// ==================================================
//  記事生成 API（Claude Sonnet 4）
// ==================================================
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "title is empty" });
    if (!keyword?.trim()) return res.status(400).json({ error: "keyword is empty" });

    const prompt = `
あなたはSEO検定1級のプロライターです。
以下の厳密なルールに従い、日本語でSEO最適化されたブログ記事を生成してください。

【絶対出力形式】
JSON のみ。余計な説明禁止。

{
  "html": "<h1>...</h1>...",
  "text": "## H2: ...\n本文..."
}
【構成ルール】
1) <h1> にタイトル（指定されたもの）をそのまま使用。
2) H2 を5つ以上。キーワードまたは類義語を自然に含める。
3) 各H2 の下に H3 を3つ以上。
4) H3 各本文は300文字以上。
5) 導入文は500文字以上。
6) 記事全体は4000〜7000文字。
7) 語尾連続禁止（です。です。→禁止）
8) 主語連続禁止（〜は、〜は →禁止）
9) 読者に語るような優しい口調（〜ですよ、〜なんです、〜といえます）
10) <h2> と <h3> の上下には必ず1行の改行。
11) **最後に必ず H2「まとめ」を作成し、500文字以上で締めること。**
12) 必ず JSON が閉じた状態で終わること（} で確実に終了する）

指定タイトル：${title}
キーワード：${keyword}
`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        temperature: 0.65,
        messages: [
          { role: "user", content: prompt }
        ]
      }),
    });

    const apiData = await response.json();
    const raw = apiData?.content?.[0]?.text || "";

    const parsed = extractJSONFromText(raw);

    // JSON抽出に失敗 → 空値を絶対に返さない（コピー不具合対策）
    if (!parsed) {
      return res.json({
        html: "<p>生成に失敗しました（JSON解析エラー）</p>",
        text: "生成に失敗しました（JSON解析エラー）"
      });
    }

    res.json({
      html: parsed.html || "<p>HTML生成に失敗しました</p>",
      text: parsed.text || "テキスト生成に失敗しました"
    });

  } catch (err) {
    console.error("generate-article error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// 起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
