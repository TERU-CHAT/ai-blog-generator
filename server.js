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
      "connect-src 'self' https://api.openai.com"
  );
  next();
});

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ヘルパー: テキストから最初の JSON オブジェクトを抽出して parse
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

// -----------------------------
//  タイトル生成 API（5個）
// -----------------------------
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
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
- キーワードはすべて自然に含める。
- 番号は付けない。
- 検索意図が明確でクリックされやすい表現。
- 余計な説明は出力しない。
`;

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
        temperature: 0.8,
        max_tokens: 800,
      }),
    });

    const apiData = await response.json();
    const raw = apiData.choices?.[0]?.message?.content || "";
    const parsed = extractJSONFromText(raw);

    if (!parsed || !Array.isArray(parsed.titles)) {
      const fallback = raw
        .split(/\r?\n/)
        .map((s) => s.replace(/^[0-9\.\-\)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
      return res.json({ titles: fallback });
    }

    const titles = parsed.titles.slice(0, 5);
    while (titles.length < 5) titles.push("");

    res.json({ titles });
  } catch (err) {
    console.error("generate-titles error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// -----------------------------
//  記事生成 API（HTML + text）
// -----------------------------
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "title is empty" });
    if (!keyword?.trim()) return res.status(400).json({ error: "keyword is empty" });

    const systemPrompt = `
あなたはSEO検定1級レベルのプロライターです。
以下のルールに従って、日本語のSEO対策をしたブログ記事を生成してください。

【出力形式（必須）】
必ず JSON のみ。余計なコメント禁止。

{
  "html": "<h1>...</h1>...",
  "text": "## H2: ...\n本文..."
}

【構成ルール】
1) H1 は指定タイトルをそのまま使用（<h1>）。
2) H2 を 5個以上、キーワードまたは類義語を自然に含める。
3) 各 H2 の下に H3 を３つ以上置く。
4) 各 H3 の本文は 300文字以上。
5) 導入文は 500文字以上。
6) 総文字数は 4000文字以上。
7) 文末は **1文ごとに改行**。
8) 読者に語りかける優しい口調（〜ですよ、〜なんです、〜と思えるはずですよ など）。
9) <h2><h3> の **前後に必ず1行改行** を入れること。
10) 主語の連続（「〜は、〜は」）を避け自然な文章にする。
11) 語尾の連続（「〜です。」「〜です。」）は禁止。語尾バリエーションを広く使用する。
12) 語尾の例：
- 〜ですよ
- 〜なんです
- 〜といえます
- 〜と考えられています
- 〜のが特徴です
- 〜でしょう
- 〜になります
- 〜とされています
- 〜と感じられるはずです
- 〜と言えるでしょう
- 〜でしょうね
- 〜という流れになります
（これらを自然に散りばめる）
13) 最後に必ず H2「まとめ」を作成し、500文字以上で締める。
14) HTML と text の内容は一致させること。

【注意】
- JSON 以外の文字は絶対に出力しない。
`;

    const userPrompt = `タイトル: ${title}
キーワード: ${keyword}`;

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
        temperature: 0.65,
        max_tokens: 10000
      }),
    });

    const apiData = await response.json();
    const raw = apiData.choices?.[0]?.message?.content || "";
    const parsed = extractJSONFromText(raw);

    if (!parsed || (!parsed.html && !parsed.text)) {
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
