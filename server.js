import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();

// ---------------------- Content Security Policy ----------------------
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; \
    img-src 'self' data:; \
    font-src 'self' https://fonts.gstatic.com; \
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; \
    script-src 'self' 'unsafe-inline'; \
    connect-src 'self' https://api.openai.com"
  );
  next();
});

// ---------------------- Middleware ----------------------
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ---------------------- ENV ----------------------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ---------------------- Title API ----------------------
app.post("/api/titles", async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: "keyword is empty" });
    }

    const systemPrompt = `
あなたはSEOに詳しい日本語プロ編集者です。
与えられたキーワードを必ず自然に含めながら、検索でクリックされやすい魅力的なブログタイトルを10個生成してください。
`;

    const userPrompt = `キーワード：${keyword}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 500
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data });
    }

    const titles = data.choices[0].message.content
      .split("\n")
      .filter((t) => t.trim().length > 0);

    res.json({ titles });
  } catch (err) {
    res.status(500).json({ error: "server error", detail: err });
  }
});

// ---------------------- Port ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
