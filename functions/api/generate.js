export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const keyword = body.keyword || "";

    if (!keyword) {
      return json({ error: "keyword empty" }, 400);
    }

    const systemPrompt = "あなたはSEO記事生成AI。必ずJSON形式で出力...";
    const userPrompt = `キーワード: ${keyword}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const j = await r.json();

    return json(j);

  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
