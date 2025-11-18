export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { keyword, tone, title } = req.body;

    if (!keyword || !title) {
      return res.status(400).json({ error: "Missing keyword or title" });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "SEO記事生成AI" },
          { role: "user", content: `キーワード:${keyword}\nタイトル:${title}\nTone:${tone}` }
        ]
      })
    });

    const json = await openaiRes.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}");

    res.status(200).json({
      markdown: parsed.markdown || "",
      html: parsed.html || ""
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
