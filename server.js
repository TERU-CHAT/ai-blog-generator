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
// HTMLに改行を適用（ダブル改行で読みやすく）
// --------------------------------------------------
function formatHTMLWithLineBreaks(html) {
  if (!html) return "";
  
  // pタグ、liタグ内のテキストを1文ごとに<br><br>で区切る
  let formatted = html.replace(/>([^<]+)</g, (match, text) => {
    // タグに囲まれたテキスト部分のみ処理
    if (text.trim()) {
      let formattedText = text.replace(/([^0-9])。(?!\s*<)/g, "$1。<br><br>");
      formattedText = formattedText.replace(/([？！])(?!\s*<)/g, "$1<br><br>");
      return `>${formattedText}<`;
    }
    return match;
  });
  
  return formatted;
}

// ==================================================
// タイトル生成 API（最大1000トークン）
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
// 記事生成 API（E-A-T対応・HTML形式のみ・最大10000トークン）
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

    console.log(`📝 記事生成開始（E-A-T対応）: ${title}`);

    const prompt = `あなたは専門性の高いプロのSEOライターです。Google検索で上位表示されるために、E-A-T（専門性・権威性・信頼性）を重視した高品質な記事を生成してください。

【重要】以下のJSON形式のみで回答してください。JSONの前後に説明文を含めないでください。

{
  "html": "HTMLコンテンツ全体"
}

タイトル: ${title}
キーワード: ${keyword}

【E-A-T（専門性・権威性・信頼性）の実装方法】

1. Expertise（専門性）の表現
   - 専門用語を正確に使用し、初心者にもわかりやすく解説
   - 具体的な数値、データ、統計を積極的に活用
   - 業界の最新トレンドや実践的な知識を盛り込む
   - 「〜という研究結果があります」「専門家によると」などの表現を使用

2. Authoritativeness（権威性）の表現
   - 情報源を明示する表現（「〇〇省のデータによると」「業界団体の調査では」）
   - 専門家の見解や公式見解を引用する形式
   - 実例・事例を具体的に紹介
   - 段階的・体系的な説明で信頼感を構築

3. Trustworthiness（信頼性）の表現
   - メリットだけでなくデメリットや注意点も公平に記載
   - 「〜には個人差があります」など誠実な表現
   - 最新情報であることを示唆（「2024年現在」「最新の」など）
   - 読者に誤解を与えない正確で慎重な表現

【記事構成の必須条件】
- 導入文: 400文字以上（読者の課題に共感し、記事の価値を提示）
- H2見出し: 4つ以上（最後は必ず「まとめ」）
- H3見出し: 各H2配下に3つ以上必須
- 各H3本文: 300文字以上（重要：これは必ず守ること）
- 「まとめ」セクション: 400文字以上（記事全体を総括し、次のアクションを提示）
- 記事全体: 5000〜7000文字

【語尾のバリエーション】
読者に語りかけるような自然で親しみやすい文章：
- 「〜ですよね」「〜なんですよ」「〜ですよ」
- 「〜できますよ」「〜してみてください」「〜してみましょう」
- 「〜でしょう」「〜かもしれません」
- 体言止め（適度に使用）

※同じ語尾を3回以上連続させないこと

【HTML構造】
<h1>${title}</h1>

<div class="introduction">
  <p>導入文（400文字以上）...</p>
</div>

<section>
  <h2>見出し1</h2>
  
  <div>
    <h3>見出し1-1</h3>
    <p>本文（300文字以上）...</p>
  </div>
  
  <div>
    <h3>見出し1-2</h3>
    <p>本文（300文字以上）...</p>
  </div>
  
  <div>
    <h3>見出し1-3</h3>
    <p>本文（300文字以上）...</p>
  </div>
</section>

<section>
  <h2>見出し2</h2>
  
  <div>
    <h3>見出し2-1</h3>
    <p>本文（300文字以上）...</p>
  </div>
  
  <div>
    <h3>見出し2-2</h3>
    <p>本文（300文字以上）...</p>
  </div>
  
  <div>
    <h3>見出し2-3</h3>
    <p>本文（300文字以上）...</p>
  </div>
</section>

<section>
  <h2>見出し3</h2>
  （各H2配下に必ずH3を3つ以上配置）
</section>

<section>
  <h2>見出し4</h2>
  （各H2配下に必ずH3を3つ以上配置）
</section>

<section class="summary">
  <h2>まとめ</h2>
  <p>総括（400文字以上）...</p>
</section>

【構造の重要ポイント】
1. H2は必ず4つ以上作成（最後の1つは「まとめ」）
2. 各H2の配下には必ずH3を3つ以上配置
3. 各H3の本文は必ず300文字以上
4. 「まとめ」セクションにはH3は不要

【絶対厳守】
- JSON形式以外の出力は一切禁止
- HTMLタグは正しく閉じる
- H2は4つ以上必須（最後は「まとめ」）
- 各H2配下に必ずH3を3つ以上配置
- 各H3の本文は300文字以上必須
- 専門性と信頼性を重視した内容
- 読者にとって実用的で価値ある情報を提供

【記事のボリューム確認】
- 導入: 400文字
- H2（4つ） × H3（各3つ） × 本文（各300文字） = 3600文字
- まとめ: 400文字
- 合計: 約4000〜7000文字の充実した記事を作成`;

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
        temperature: 0.65,
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
    
    console.log("==========================================");
    console.log("📥 Claude API レスポンス:");
    console.log("==========================================");
    console.log("Response Length:", raw.length, "文字");
    console.log("First 500 chars:");
    console.log(raw.substring(0, 500));
    console.log("==========================================");

    const parsed = extractLargestJSON(raw);
    
    console.log("🔍 JSON解析結果:");
    console.log("Parsed:", parsed ? "成功" : "失敗");
    if (parsed) {
      console.log("HTML exists:", !!parsed.html);
      console.log("HTML length:", parsed.html?.length || 0, "文字");
    }

    if (!parsed || !parsed.html) {
      console.error("==========================================");
      console.error("❌ JSON解析失敗の詳細");
      console.error("==========================================");
      console.error("Parsed object:", JSON.stringify(parsed, null, 2));
      console.error("Raw response (first 1000 chars):", raw.substring(0, 1000));
      console.error("==========================================");
      
      return res.json({
        html: `<div class='error'>
          <h2>⚠️ 生成に失敗しました</h2>
          <p>もう一度お試しください。それでも失敗する場合は、タイトルやキーワードを変更してみてください。</p>
          <details>
            <summary>デバッグ情報</summary>
            <pre>${raw.substring(0, 500)}</pre>
          </details>
        </div>`,
        text: "",
        debug: {
          rawLength: raw.length,
          rawPreview: raw.substring(0, 500),
          parsedKeys: parsed ? Object.keys(parsed) : []
        }
      });
    }

    // 1文ごとに改行を追加（ダブル改行）
    const formattedHTML = formatHTMLWithLineBreaks(parsed.html);

    console.log(`✅ 記事生成成功（E-A-T対応）- HTML: ${formattedHTML.length}文字`);

    res.json({
      html: formattedHTML,
      text: "" // テキスト形式は不要なので空文字
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
    timestamp: new Date().toISOString(),
    config: {
      titleMaxTokens: 1000,
      articleMaxTokens: 12000,
      eatOptimized: true,
      outputFormat: "HTML only",
      structure: {
        h2: "4つ以上",
        h3PerH2: "3つ以上",
        h3MinChars: "300文字以上"
      }
    }
  });
});

// 起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 API Key configured: ${!!CLAUDE_API_KEY}`);
  console.log(`📊 Config: Title=1000tokens, Article=12000tokens`);
  console.log(`🎯 E-A-T最適化: 有効`);
  console.log(`📝 出力形式: HTML形式のみ`);
  console.log(`📐 記事構造: H2(4+) > H3(3+/H2) > 本文(300+文字/H3)`);
});
