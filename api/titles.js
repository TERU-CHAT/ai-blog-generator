export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { keyword } = req.body || {};
  if (!keyword) {
    return res.status(400).json({ error: "keyword is empty" });
  }

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "ブログタイトル生成AI" },
          { role: "user", content: `キーワード:${keyword}` }
        ]
      }),
    });

    const json = await openaiRes.json();

    const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}");

    res.status(200).json({
      titles: parsed.titles || [],
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
