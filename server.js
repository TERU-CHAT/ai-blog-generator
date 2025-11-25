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
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ヘルパー: テキストから最初の JSON オブジェクトを抽出して parse
function extractJSONFromText(text) {
  if (!text) return null;
  // まず ```json ``` ブロックを外す
  text = text.replace(/```json|```/g, "").trim();

  // 最長の { ... } を探す（ネストを簡易無視して最初にマッチするブロック）
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    // try to fix trailing commas
    const cleaned = match[0].replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]");
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      return null;
    }
  }
}

// -------------------------------------------------
// タイトル生成 API（5個） — 元ロジックを維持
// -------------------------------------------------
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: "keyword is empty" });
    }

    const systemPrompt = `
あなたはSEO検定1級レベルの日本語プロ編集者です。
指示に従って、キーワード（空白区切り）を必ず含む魅力的なブログタイトルを**ちょうど5件** JSON 配列で出力してください。
出力は必ず JSON のみで、以下の形式で返してください（余計な説明はしないでください）：
{ "titles": ["タイトルA", "タイトルB", "タイトルC", "タイトルD", "タイトルE"] }

条件:
- キーワードは空白で渡されます（例: 脱毛 医療 料金）。
- タイトルの先頭に '1.' 等の番号は付けないでください（生のタイトル文字列のみ）。
- 検索意図が明確でクリックされやすい表現にしてください。
- 語尾は自然で読者に語りかける口調を意識してもよいが、タイトルは読みやすさ優先で。

必ず JSON のみを出力してください。
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
        max_tokens: 1200, // タイトル生成は小さめで十分
      }),
    });

    const apiData = await response.json();
    const raw = apiData.choices?.[0]?.message?.content || apiData.choices?.[0]?.text || "";
    const parsed = extractJSONFromText(raw);

    if (!parsed || !Array.isArray(parsed.titles)) {
      // フォールバック: 改行で分割して上位5件を返す
      const fallback = raw
        .split(/\r?\n/)
        .map((s) => s.replace(/^[0-9\.\-\)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
      return res.json({ titles: fallback });
    }

    // Ensure exactly 5 (if model returned more/less, normalize)
    const titles = parsed.titles.slice(0, 5);
    while (titles.length < 5) titles.push("");

    res.json({ titles });
  } catch (err) {
    console.error("generate-titles error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// -------------------------------------------------
// 記事生成 API（HTML + Text を JSON で返す）
// 変更点: max_tokens を 15000 に引き上げ、フォールバック強化
// -------------------------------------------------
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "title is empty" });
    if (!keyword || !keyword.trim()) return res.status(400).json({ error: "keyword is empty" });

    // system prompt: 明確かつ厳密に構成ルールを指定（元の指示を保持）
    const systemPrompt = `
あなたはSEO検定1級レベルのプロライターです。
以下の厳密なルールに従って、ブログ記事を生成してください。

【出力形式（必須）】
必ず JSON のみを出力してください。余計な説明は出力しないこと。
JSON フィールド:
{
  "html": "<h1>...</h1><h2>...</h2><h3>...</h3><p>...</p>...", 
  "text": "プレーンテキスト（見出しは ## H2: タイトル / ### H3: タイトル のように分かりやすく）"
}

【構成ルール】
1) H1 は与えられたタイトル（正確に）を使うこと（<h1>タイトル</h1>）。
2) H2 を**5個以上**作ること。各 H2 にはキーワードかその類義語を**自然に含める**こと。
3) 各 H2 の下に**H3 を少なくとも2個**配置すること（合計で最低10個のH3）。
4) 各 H3 の本文は**300文字以上**にすること。
5) 導入（記事冒頭の導入文）は**500文字以上**、まとめ（記事末）は**500文字以上**にすること。
6) 記事全体の総文字数は**3000文字以上**にすること。
7) 各文章は**1文ごとに改行**（段落内でも文の終わりで改行する）すること。
8) 文章の語尾は読者に語りかける口調（「〜ですよ」「〜なんですよね」「〜できますよ」など）を適度に混ぜつつ自然にすること。
9) H2/H3 見出しは HTML タグ（<h2>, <h3>）で出力し、本文は <p> で囲むこと。
10) HTML と同じ内容のプレーンテキストも "text" に入れること（見出しは ## H2: 見出し / ### H3: 見出し のように分かりやすく）。

【注意】
- 出力は必ず JSON で、"html" と "text" を含めてください。
- 文章中に余計な説明文や生成手順を混ぜないこと。
- キーワードは空白区切りで複数渡されるので、適切に散りばめてください。
`;

    const userPrompt = `タイトル: ${title}
キーワード: ${keyword}
`;

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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 15000  // <- 15000トークンに拡張
      }),
    });

    const apiData = await response.json();
    const raw = apiData.choices?.[0]?.message?.content || apiData.choices?.[0]?.text || "";
    const parsed = extractJSONFromText(raw);

    // parsed が取れない／html がない場合、フォールバックで text->html を生成して返す
    if (!parsed) {
      // attempt: if raw contains HTML-like tags, return raw as html
      const looksLikeHtml = /<\s*\/?\s*\w+[^>]*>/.test(raw);
      if (looksLikeHtml) {
        // wrap raw into JSON response
        // also try to extract a reasonable plain text (strip tags)
        const plain = raw.replace(/<[^>]*>/g, "").trim();
        return res.json({ html: raw, text: plain });
      } else {
        // raw isn't JSON nor HTML — return raw as text and attempt simple html conversion
        const paragraphs = raw.split(/\n{2,}/).map(p => `<p>${p.trim().replace(/\n/g, " ")}</p>`).join("\n");
        return res.json({ html: paragraphs, text: raw });
      }
    }

    // parsed exists
    let htmlOut = parsed.html || "";
    let textOut = parsed.text || "";

    // If html missing but text present, convert text -> simple HTML (preserve line breaks as <p>)
    if ((!htmlOut || !htmlOut.trim()) && textOut && textOut.trim()) {
      const paragraphs = textOut.split(/\n{2,}/).map(p => `<p>${p.trim().replace(/\n/g, " ")}</p>`).join("\n");
      htmlOut = paragraphs;
    }

    res.json({ html: htmlOut, text: textOut });
  } catch (err) {
    console.error("generate-article error:", err);
    res.status(500).json({ error: "server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
