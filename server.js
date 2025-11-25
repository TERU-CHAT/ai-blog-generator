// server.js（タイトル案をHTML化して確実に表示させる版）

import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


// ---- Markdown → HTML（最軽量の変換） ----
function mdToHtml(md) {
    if (!md) return "";

    let html = md;

    // H2
    html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");

    // H3
    html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");

    // リスト
    html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>[\s\S]*?<\/li>)/gm, "<ul>$1</ul>");

    // 段落
    html = html.replace(/([^>\n]+)\n/g, "<p>$1</p>");

    return html;
}


// ---- プロンプト ----
function buildPrompt(keyword) {
    return `
以下の条件に従い、SEO記事を生成してください。

【キーワード】${keyword}

【出力順】
1. ## タイトル候補
- タイトル案1
- タイトル案2
- タイトル案3
- タイトル案4
- タイトル案5

2. ## 本文（HTML形式）
H2は「## H2: 見出し」
H3は「### H3: 見出し」
本文は<p></p>で囲む

【制約】
・H2 5つ以上
・H3 各H2に2つ以上
・H3本文は300文字以上
・総文字数3000字以上
`;
}


// ---- API ----
app.post("/generate", async (req, res) => {
    const { keyword } = req.body;

    if (!keyword) {
        return res.json({ error: "キーワードを入力してください。" });
    }

    try {
        const payload = {
            model: "gpt-4o",
            max_tokens: 15000,
            temperature: 0.7,
            messages: [
                { role: "user", content: buildPrompt(keyword) }
            ]
        };

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.choices) {
            return res.json({ error: "AI応答が取得できません。" });
        }

        const raw = data.choices[0].message.content;

        // ▼ Markdown → HTML に変換してから返す（ここが超重要）
        const html = mdToHtml(raw);

        return res.json({
            html: html,
            raw: raw
        });

    } catch (e) {
        console.error(e);
        return res.json({ error: "サーバーエラーが発生しました。" });
    }
});


// ---- SERVER START ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
