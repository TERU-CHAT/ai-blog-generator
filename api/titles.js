// api/titles.js
const TITLES_SYSTEM_PROMPT = `
あなたはSEO検定1級レベルの知識を持つ日本語のプロSEOライターです。
ユーザーが指定したキーワードから検索意図を推測し、
思わずクリックしたくなる自然な日本語のブログタイトルを5つだけ提案してください。

【疑似SERP生成】
- 実際の検索結果にはアクセスせず、あなたの知識から
  「検索上位にありそうな記事構成・ニーズ」を頭の中でシミュレートしてください。
- その上で、既存記事と被りすぎないオリジナル性のあるタイトルを考えてください。

【ルール】
- 出力は有効なJSONのみ。
- 形式: { "keyword": "入力キーワード", "titles": ["...", "...", "...", "...", "..."] }
- titles配列は必ず5つ。
- 各タイトルには必ず「keyword全体」を自然な形で含める。
- 読者の悩み・願望に寄り添った表現にする。
- 誇大広告的・煽りすぎる表現は避ける。
- クリック後に「読んで良かった」と感じる内容を約束する誠実なタイトルにする。
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { keyword } = req.body || {};
    const kw = (keyword || "").trim();

    if (!kw) {
      res.status(400).json({ error: "keyword is empty" });
      return;
    }

    const userPrompt = `
keyword: 「${kw}」

このキーワード文字列全体を1つのフレーズとして扱い、
スペースが含まれていても順序を崩さずタイトル内に自然に含めてください。
JSONだけを返してください。
`;

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: TITLES_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!apiRes.ok) {
      const t = await apiRes.text();
      res.status(500).json({ error: "OpenAI titles API error", detail: t });
      return;
    }

    const data = await apiRes.json();
    let parsed;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch (e) {
      res.status(500).json({ error: "Failed to parse titles JSON", raw: data });
      return;
    }

    if (!Array.isArray(parsed.titles) || parsed.titles.length !== 5) {
      res
        .status(500)
        .json({ error: "Invalid titles structure", raw: parsed });
      return;
    }

    res.status(200).json({ keyword: kw, titles: parsed.titles });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
