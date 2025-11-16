// api/article.js
const ARTICLE_SYSTEM_PROMPT = `
あなたはSEO検定1級に合格している超一流の日本語プロライター兼構成プランナーです。
以下の条件を満たすブログ記事をMarkdownで執筆します。

【目的】
- 指定されたブログタイトルの検索意図に基づき、読者の悩みを解決し、気づきと満足感を与える。
- SEOを意識しつつも、人間が読んで自然で読みやすい文章にする。

【構成ルール】
- 先頭にH1としてタイトル（# タイトル）。
- 導入文: キーワードを必ず含める。読者の現状・悩みへの共感と記事全体の概要。
- H2見出し: 5個以上。検索意図を分解し、段階的に疑問を解消する流れ。
  - 各H2タイトルにも自然な形でキーワードや関連語を含める。
- 各H2の下にH3見出しを最低2つ以上。
- 各H3本文は1つあたり300文字以上を目安。
- まとめ: キーワードを必ず含め、要点整理と次の一歩につながるメッセージ。
- 全体として3000文字以上を意識（不足していても再リクエストは不要）。

【SEOと文章スタイル】
- キーワードは導入文・まとめで必ず使用し、本文中にも不自然でない頻度で散りばめる。
- 関連語・共起語も文脈上自然な範囲で盛り込む。
- 同じ語尾（〜です。〜ます。）が3回以上連続しないように、表現を言い換える。
- 読者の「あるあるな悩み」や「勘違いしやすいポイント」に触れつつ、優しく正しい方向へ導く。

【文体バリエーション（tone）】
- polite: 丁寧でニュートラル。
- feminine: やわらかく寄り添う女性的な印象。
- masculine: 落ち着いていて少し力強い男性的な印象。
- expert: 専門家として論理的だが、必ず噛み砕いて説明。
- friendly: 読者に語りかけるカジュアル寄り。「〜ですよ」「〜してみてくださいね」なども適度に。

【疑似SERP生成】
- 実際の検索エンジンにはアクセスせず、頭の中で「検索上位にありそうな記事構成」を想定。
- それらと差別化できるように、オリジナルの切り口・分かりやすさ・網羅性を高める。

【出力形式】
- 有効なJSONのみを返す。
- 形式: { "markdown": "記事全文（Markdown）" }
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { keyword, tone, title } = req.body || {};
    const kw = (keyword || "").trim();
    const tn = (tone || "polite").trim();
    const tt = (title || "").trim();

    if (!kw) {
      res.status(400).json({ error: "keyword is empty" });
      return;
    }
    if (!tt) {
      res.status(400).json({ error: "title is empty" });
      return;
    }

    const userPrompt = `
【キーワード】
${kw}

【ブログタイトル】
${tt}

【tone】
${tn}

この条件で、指定ルールに従ったMarkdown記事を書き、
指定されたJSONフォーマットだけを返してください。
`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: ARTICLE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!apiRes.ok) {
      const t = await apiRes.text();
      res.status(500).json({ error: "OpenAI article API error", detail: t });
      return;
    }

    const data = await apiRes.json();
    let parsed;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch (e) {
      res.status(500).json({ error: "Failed to parse article JSON", raw: data });
      return;
    }

    const markdown = (parsed.markdown || "").trim();
    if (!markdown) {
      res.status(500).json({ error: "No markdown content returned", raw: parsed });
      return;
    }

    const html = markdownToHtml(markdown);
    res.status(200).json({ markdown, html });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}

// --- 簡易 Markdown → HTML 変換（見出し＋段落＋箇条書き） ---
function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += "\n";
      continue;
    }
    if (trimmed.startsWith("### ")) {
      html += "<h3>" + escapeHtml(trimmed.slice(4)) + "</h3>\n";
    } else if (trimmed.startsWith("## ")) {
      html += "<h2>" + escapeHtml(trimmed.slice(3)) + "</h2>\n";
    } else if (trimmed.startsWith("# ")) {
      html += "<h1>" + escapeHtml(trimmed.slice(2)) + "</h1>\n";
    } else if (trimmed.startsWith("- ")) {
      html += "<p>・" + escapeHtml(trimmed.slice(2)) + "</p>\n";
    } else {
      html += "<p>" + escapeHtml(trimmed) + "</p>\n";
    }
  }
  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
