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

if (!CLAUDE_API_KEY) {
  console.error("⚠️  CLAUDE_API_KEY is not set!");
}

// --------------------------------------------------
// 改善版JSONパーサー（より堅牢に）
// --------------------------------------------------
function extractLargestJSON(text) {
  if (!text) return null;

  // Step 1: コードブロック記法を除去
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Step 2: 前後の不要なテキストを除去
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  
  if (firstBrace === -1 || lastBrace === -1) return null;
  
  cleaned = cleaned.substring(firstBrace, lastBrace + 1);

  // Step 3: すべてのJSON候補を抽出
  const jsonCandidates = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    }
    if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        jsonCandidates.push(cleaned.substring(start, i + 1));
        start = -1;
      }
    }
  }

  if (jsonCandidates.length === 0) {
    // 最後の手段: 全体をパースしてみる
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }

  // Step 4: 最も長いJSON候補からパースを試行
  jsonCandidates.sort((a, b) => b.length - a.length);

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      // 有効なオブジェクトかチェック
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

// --------------------------------------------------
// 新機能: 1文ごとに改行を追加
// --------------------------------------------------
function formatTextWithLineBreaks(text) {
  if (!text) return "";
  
  // 句点（。）の後に改行を追加（ただし、数字の後の。は除外）
  let formatted = text.replace(/([^0-9])。/g, "$1。\n");
  
  // 疑問符・感嘆符の後も改行
  formatted = formatted.replace(/([？！])/g, "$1\n");
  
  // 連続する改行を2つまでに制限
  formatted = formatted.replace(/\n{3,}/g, "\n\n");
  
  return formatted.trim();
}

// --------------------------------------------------
// 新機能: HTMLにも改行を適用
// --------------------------------------------------
function formatHTMLWithLineBreaks(html) {
  if (!html) return "";
  
  // pタグ、liタグ内のテキストを1文ごとに<br>で区切る
  let formatted = html.replace(/>([^<]+)</g, (match, text) => {
    // タグに囲まれたテキスト部分のみ処理
    if (text.trim()) {
      let formattedText = text.replace(/([^0-9])。(?!\s*<)/g, "$1。<br>");
      formattedText = formattedText.replace(/([？！])(?!\s*<)/g, "$1<br>");
      return `>${formattedText}<`;
    }
    return match;
  });
  
  return formatted;
}

// ==================================================
// タイトル生成 API (改善版)
// ==================================================
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { keyword } = req.body;
    
    // バリデーション強化
    if (!keyword?.trim()) {
      return res.status(400).json({ error: "キーワードを入力してください" });
    }
    
    if (keyword.length > 100) {
      return res.status(400).json({ error: "キーワードが長すぎます（100文字以内）" });
    }

    console.log(`📝 タイトル生成開始: ${keyword}`);

    const prompt = `あなたはSEO専門家です。以下のキーワードに対して、検索上位を狙える魅力的なタイトルを5つ生成してください。

【重要】以下のJSON形式のみで回答してください。他の文章は一切含めないでください。

{
  "titles": [
    "タイトル1",
    "タイトル2",
    "タイトル3",
    "タイトル4",
    "タイトル5"
  ]
}

キーワード: ${keyword}

条件:
- 各タイトルは30〜40文字程度
- 数字や具体性を含める
- クリックしたくなる魅力的な表現
- SEOキーワードを自然に含める`;

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

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Claude API Error:", errorData);
      return res.status(500).json({ 
        error: "API接続エラー",
        details: errorData.error?.message 
      });
    }

    const apiData = await response.json();
    const raw = apiData?.content?.[0]?.text || "";
    
    console.log("📥 Claude Response:", raw.substring(0, 200) + "...");

    const parsed = extractLargestJSON(raw);

    if (!parsed?.titles || !Array.isArray(parsed.titles)) {
      console.error("❌ JSON解析失敗:", raw);
      return res.json({ 
        titles: [
          "生成に失敗しました",
          "もう一度お試しください",
          "キーワードを変更してみてください"
        ]
      });
    }

    const titles = parsed.titles.slice(0, 5).filter(t => t && t.trim());
    
    if (titles.length === 0) {
      return res.json({ 
        titles: ["タイトル生成に失敗しました"] 
      });
    }

    console.log(`✅ タイトル生成成功: ${titles.length}件`);
    res.json({ titles });

  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ 
      error: "サーバーエラーが発生しました",
      message: err.message 
    });
  }
});

// ==================================================
// 記事生成 API (改善版 + 改行機能追加)
// ==================================================
app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, keyword } = req.body;
    
    // バリデーション
    if (!title?.trim()) {
      return res.status(400).json({ error: "タイトルを入力してください" });
    }
    if (!keyword?.trim()) {
      return res.status(400).json({ error: "キーワードを入力してください" });
    }

    console.log(`📝 記事生成開始: ${title}`);

    const prompt = `あなたは超一流のSEOライターです。以下の条件で記事を生成してください。

【最重要】以下のJSON形式のみで回答してください。JSONの前後に説明文を含めないでください。

{
  "html": "HTMLコンテンツ全体",
  "text": "プレーンテキスト全体"
}

タイトル: ${title}
キーワード: ${keyword}

【必須条件】
1. 導入文: 500文字以上で読者の興味を引く
2. H2見出し: 5つ以上（最後は必ず「まとめ」）
3. H3見出し: 各H2配下に3つ以上
4. 各セクション本文: 300文字以上
5. 記事全体: 4000〜7000文字
6. 語尾の連続禁止（です・ます・でしょう等を交互に）
7. 主語の連続禁止
8. 親しみやすい語りかけ口調
9. まとめセクション: 500文字以上で記事全体を総括

【HTMLフォーマット】
- h1タグでタイトル
- h2、h3タグで見出し構造
- pタグで段落
- ulタグで箇条書き（必要に応じて）

【textフォーマット】
- ## H2見出し
- ### H3見出し
- 本文は通常のテキスト`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 12000,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Claude API Error:", errorData);
      return res.status(500).json({ 
        error: "API接続エラー",
        details: errorData.error?.message 
      });
    }

    const apiData = await response.json();
    const raw = apiData?.content?.[0]?.text || "";
    
    console.log("📥 Claude Response Length:", raw.length);
    console.log("📥 First 300 chars:", raw.substring(0, 300));

    const parsed = extractLargestJSON(raw);

    if (!parsed || !parsed.html || !parsed.text) {
      console.error("❌ JSON解析失敗");
      console.error("Raw response:", raw.substring(0, 500));
      
      return res.json({
        html: "<div class='error'><h2>⚠️ 生成に失敗しました</h2><p>もう一度お試しください。それでも失敗する場合は、タイトルやキーワードを変更してみてください。</p></div>",
        text: "生成に失敗しました。もう一度お試しください。",
      });
    }

    // 1文ごとに改行を追加
    const formattedHTML = formatHTMLWithLineBreaks(parsed.html);
    const formattedText = formatTextWithLineBreaks(parsed.text);

    console.log(`✅ 記事生成成功 - HTML: ${formattedHTML.length}文字, Text: ${formattedText.length}文字`);

    res.json({
      html: formattedHTML,
      text: formattedText,
    });

  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ 
      error: "サーバーエラーが発生しました",
      message: err.message 
    });
  }
});

// ヘルスチェック用エンドポイント
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    apiKeyConfigured: !!CLAUDE_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// 起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 API Key configured: ${!!CLAUDE_API_KEY}`);
});
