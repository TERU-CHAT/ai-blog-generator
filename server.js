/**
 * server.js
 * 強化版：長文生成安定化（各節最低文字数指定・段階生成プロンプト・トークン余裕設定）
 * - 元の構成を維持しつつ、必ず導入/各H3/まとめの最低文字数を満たす指示を追加
 * - 生成は JSON(html, text) を返却（フォールバック処理込み）
 * - 出力トークンに余裕を持たせるため max_tokens を大きめに設定
 */

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

/**
 * extractJSONFromText
 * テキスト中の最初の JSON オブジェクトを抽出して parse する
 */
function extractJSONFromText(text) {
  if (!text) return null;
  // remove triple-backtick fences
  text = text.replace(/```json|```/g, "").trim();

  // find first { ... } block (greedy)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    // try cleaning common issues (trailing commas)
    const cleaned = match[0].replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]");
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      return null;
    }
  }
}

/**
 * simpleHtmlFromText
 * プレーンテキストを簡易 HTML に変換（段落ごとに <p>）
 */
function simpleHtmlFromText(text) {
  if (!text) return "";
  const paragraphs = text
    .split(/\n{2,}/) // 空行で段落区切り
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, " ")}</p>`)
    .join("\n");
  return paragraphs || `<p>${text.replace(/\n/g, "<br>")}</p>`;
}

/**
 * safeRespond
 * 一貫した JSON を返すユーティリティ
 */
function safeRespond(res, obj) {
  try {
    res.json(obj);
  } catch (e) {
    console.error("safeRespond error:", e);
    res.status(500).json({ error: "server error" });
  }
}

// -----------------------------
// タイトル生成 API（安定版）
// -----------------------------
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: "keyword is empty" });
    }

    const systemPrompt = `
あなたはSEO検定1級レベルの日本語プロ編集者です。
以下の形式のみを出力してください（余計な説明は不要）：
{ "titles": ["タイトルA", "タイトルB", "タイトルC", "タイトルD", "タイトルE"] }

条件：
- キーワードは必ず自然に含める。
- ちょうど5件出力する。
- 番号や注釈は付けない（生のタイトル文字列のみ）。
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
        max_tokens: 1200,
        top_p: 0.95,
        presence_penalty: 0,
        frequency_penalty: 0.2
      }),
    });

    const apiData = await apiRes.json();
    const raw = apiData.choices?.[0]?.message?.content || apiData.choices?.[0]?.text || "";
    const parsed = extractJSONFromText(raw);

    if (!parsed || !Array.isArray(parsed.titles)) {
      // フォールバック：行分割して上位5件を返す
      const fallback = raw
        .split(/\r?\n/)
        .map(s => s.replace(/^[0-9\.\-\)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
      return safeRespond(res, { titles: fallback });
    }

    const titles = parsed.titles.slice(0, 5);
    while (titles.length < 5) titles.push("");

    safeRespond(res, { titles });
  } catch (err) {
    console.error("generate-titles error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// -----------------------------
// 記事生成 API（強化版）
// ・段階生成（構成作成→各節展開）を促すプロンプト
// ・各部の最低文字数を厳密に指定
// ・語尾・主語連続・見出し上下改行などの品質指示を追加
// -----------------------------
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "title is empty" });
    if (!keyword || !keyword.trim()) return res.status(400).json({ error: "keyword is empty" });

    /**
     * 改良ポイントの要約（モデルに明確に伝えるための system prompt）
     * - 構成を先に作成し、その後各節を指定文字数で展開する段階生成を要求
     * - 各パートの最低文字数を厳密に指定
     * - 語尾バリエーション・主語連続回避・見出し上下改行の徹底
     * - 最後に必ず H2「まとめ」を 600〜800 文字で作成する
     * - 出力は必ず JSON のみ（html, text）
     */
    const systemPrompt = `
あなたはSEO検定1級レベルのプロライターかつドキュメント構築の専門家です。
以下の「段階的手順」に厳密に従って、検索上位を狙える日本語の長文SEO記事を生成してください。
出力は**必ず JSON のみ**とし、余計な説明文を含めてはいけません。

【全体手順（必須）】
1) 最初に「記事構成（見出しリスト）」を作成してください。H1（指定タイトル）／H2（5以上）／各H2のH3（2以上）を列挙してください。
   - この段階は「見出しのツリー」だけを作成するイメージです。
2) 次に、その構成に従って**各パートを順に展開**してください。展開は H2 ごとに行い、関連する H3 を各H2の下で展開してください。
3) 各 H3 の本文は**必ず 350〜450 文字**で執筆してください（文字数の範囲内に収めること）。
4) 導入（記事冒頭）は **600〜800 文字** としてください。
5) 「まとめ」は最後に必ず作成し、**600〜800 文字**で締めくくってください。
6) 見出し（H2/H3）の**前後に必ず1行分の改行**を入れてください（読みやすさのため）。
7) 文は**1文ごとに改行**すること（段落内でも文の終わりで改行）。
8) 同じ語尾（例：「〜です」「〜ます」など）を**連続して使わない**こと。語尾のバリエーションを自然に散りばめること。
9) 主語の連続（「〜は、〜は」）を避け、文のつながりを自然にしてください。
10) 語調は「読者に語りかける優しい口調」です（例：「〜ですよ」「〜なんです」「〜と感じられるはずです」 等）。
11) 生成が指定文字数に達していない場合は、自動的に補完して**必ず指定文字数を満たすこと**。途中終了や省略をしてはいけません。
12) 段階ごとに必ず「内部的にチェック」してから次に進むこと（この指示はあなたが記事の品質を担保するための手順です）。

【出力フォーマット（厳密）】
出力は JSON のみを返してください。フォーマットは必ず以下に従うこと：

{
  "html": "<h1>...</h1>\n\n<h2>...</h2>\n\n<p>...</p>\n\n<h3>...</h3>\n\n<p>...</p>\n\n...（以降同様）...",
  "text": "プレーンテキスト（見出しは ## H2: 見出し / ### H3: 見出し の形式で）"
}

注意：html と text の中身は内容が一致していること（同じ見出し・本文を両方に出力すること）。
`;

    const userPrompt = `タイトル: ${title}
キーワード: ${keyword}

※ 上記の手順に厳密に従ってください。`;

    // リクエスト（注意：max_tokens は余裕を持たせる）
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
        // 出力に余裕をもたせる（環境によって上限が異なるため注意）
        max_tokens: 18000,
        temperature: 0.65,
        top_p: 0.95,
        presence_penalty: 0,
        frequency_penalty: 0.2
      }),
    });

    const apiData = await apiRes.json();
    const raw = apiData.choices?.[0]?.message?.content || apiData.choices?.[0]?.text || "";

    // まず JSON 抽出を試みる
    const parsed = extractJSONFromText(raw);

    // もし抽出できなければ、次の順でフォールバック処理を行う：
    // 1) raw に HTML タグが含まれる場合は raw を html として返す（text はタグ除去）
    // 2) raw がプレーンテキストのみの場合は簡易 HTML に変換して返す
    if (!parsed) {
      const looksLikeHtml = /<\s*\/?\s*\w+[^>]*>/.test(raw);
      if (looksLikeHtml) {
        const plain = raw.replace(/<[^>]*>/g, "").trim();
        return safeRespond(res, { html: raw, text: plain });
      } else {
        // 生テキストの場合：構成が見える場合はそれをテキストとして返す
        // さらに簡易 HTML を作る
        const html = simpleHtmlFromText(raw);
        return safeRespond(res, { html, text: raw });
      }
    }

    // parsed がある場合、html と text を取り出す
    let htmlOut = parsed.html || "";
    let textOut = parsed.text || "";

    // html が空で text がある場合は text -> html に変換（見出し表現 ## / ### を <h2>/<h3> に変換）
    if ((!htmlOut || !htmlOut.trim()) && textOut && textOut.trim()) {
      // convert "## H2: title" and "### H3: title" to <h2>/<h3> and paragraphs
      const lines = textOut.split(/\n/);
      let htmlParts = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const m2 = line.match(/^##\s*H2:\s*(.*)$/i);
        const m3 = line.match(/^###\s*H3:\s*(.*)$/i);
        if (m2) {
          htmlParts.push("\n<h2>" + m2[1].trim() + "</h2>\n");
        } else if (m3) {
          htmlParts.push("\n<h3>" + m3[1].trim() + "</h3>\n");
        } else {
          htmlParts.push("<p>" + line + "</p>");
        }
      }
      htmlOut = htmlParts.join("\n");
    }

    // 最終的に htmlOut / textOut を返す（空の場合は raw を返す）
    if ((!htmlOut || !htmlOut.trim()) && (!textOut || !textOut.trim())) {
      return safeRespond(res, { html: raw, text: raw.replace(/<[^>]*>/g, "") });
    }

    return safeRespond(res, { html: htmlOut, text: textOut });

  } catch (err) {
    console.error("generate-article error:", err);
    res.status(500).json({ error: "server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
