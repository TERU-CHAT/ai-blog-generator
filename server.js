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
あなたはSEO検定1級レベルの優秀なコピーライターです。
以下の条件に従って、キーワード（空白区切り）を必ず含む魅力的なブログタイトルを **ちょうど5件** JSON だけで返してください。

形式：
{
  "titles": ["タイトルA", "タイトルB", "タイトルC", "タイトルD", "タイトルE"]
}

条件:
- キーワードは自然に含める。
- 番号は付けない。
- 検索意図を捉えたタイトル
- 適切な文字数（30-40文字程度）
- クリック率を高める魅力的な表現
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
        max_tokens: 1000,
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
あなたはSEO検定1級レベルのプロライターで高品質なブログ記事を執筆します。
以下のルールに従って、日本語のSEOブログ記事を生成してください。

【出力形式（必須）】
JSON のみを返す。
余計な説明文は絶対に禁止。

{
  "html": "<h1>...</h1>...",
  "text": "## H2: ...\n本文..."
}
【記事執筆の基本要件】
- 最低3000文字以上
- 導入文: 400文字～600文字（見出しなし、「導入文」という文言も不要、タイトルの直後に本文を書く）
- 見出しH2: 5個以上（各見出しは具体的で魅力的に）
- 見出しH3: 各H2の配下に3つ以上（合計15個以上）
- 各H3の本文: 300文字以上
- まとめ: 500文字以上（必須・SEO対策として最重要）
- 口調: 読者に語りかけるような優しく親しみやすい口調
- SEO最適化: キーワードを自然に配置、E-E-A-T（経験・専門性・権威性・信頼性）を意識
- 読みやすいように、1文ごとに改行する。
- <h2>及び<h3> の上下には、1行の改行を必ず入れる。

【重要】文章の書き方ルール:
- 同じ語尾を連続して使用しないこと
- 「〜です。〜です。」「〜ます。〜ます。」のような連続は避ける
- 語尾のバリエーション例:
  * 「〜です」→「〜でしょう」「〜ですね」「〜なんです」
  * 「〜ます」→「〜ましょう」「〜ますね」「〜ませんか」
  * 体言止め、疑問形、倒置法なども活用
- 文章にリズムと変化をつけて、読みやすさを向上させる

【記事構成のテンプレート】
# タイトル

（導入文500文字以上。見出しなし、「導入文」という文言も不要）

## H2見出し1（具体的な見出し名）

### H3見出し1-1
（300文字以上の本文）

### H3見出し1-2
（300文字以上の本文）

### H3見出し1-3
（300文字以上の本文）

（H2見出しを5個以上、各H2配下にH3を3つ以上作成）

## まとめ
（500文字以上の本文を必ず記載。記事の要点を整理し、読者に行動を促す内容）

【絶対厳守】
1. 「## まとめ」セクションは必ず最後に含めること
2. まとめの本文は500文字以上必須
3. 導入文には見出しをつけない
4. 「導入文」という文言は使わない
5. 記事を途中で終わらせず、必ず「## まとめ」まで完全に書き切ること`;

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
        max_tokens: 9000,
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
