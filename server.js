// server.js（完全リセット安定版 + 15000トークン + タイトル候補安定版）

import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// **安全・安定のための固定プロンプト（タイトル候補 + 本文生成）**
const buildPrompt = (keyword) => `
以下の要件に沿ってSEO記事を作成してください。

【目的】
検索上位を獲得する高品質SEO記事を生成する。

【条件】
・キーワード：${keyword}
・文字数：3000文字以上
・構成：H1（タイトル）、H2、H3 を必ず使用
・H2 は5つ以上、各 H2 の配下に H3 を2つ以上
・H3 の本文は300文字以上
・文章はプロのSEOライターとして自然で論理的
・冗長表現を避け、専門性・網羅性を高める
・読者ニーズに100%回答する構成
・タイトルはSEO最適化のうえ 5案 提示
・その後に「記事本文」を出力

【出力形式（絶対にこの順番で）】
1. ## タイトル候補
- タイトル案1
- タイトル案2
- タイトル案3
- タイトル案4
- タイトル案5

2. ## 本文
HTML形式で出力してください。
H2 → 「## H2: 見出し」
H3 → 「### H3: 見出し」
本文は段落（<p>〜</p>）で囲んでください。
`;


// ------------------- API ------------------------
app.post("/generate", async (req, res) => {
    const { keyword } = req.body;

    if (!keyword) {
        return res.json({ error: "キーワードが入力されていません。" });
    }

    try {
        const payload = {
            model: "gpt-4o",
            max_tokens: 15000,  // ★15000トークンまで拡張
            temperature: 0.7,
            messages: [
                {
                    role: "user",
                    content: buildPrompt(keyword)
                }
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

        if (!data.choices || !data.choices[0]) {
            return res.json({ error: "AIから適切な応答を得られませんでした。" });
        }

        const aiText = data.choices[0].message.content;

        // HTML抽出（HTMLがなくても必ず返す）
        let html = "";
        const htmlMatch = aiText.match(/<[^>]+>/);
        if (htmlMatch) {
            html = aiText;
        } else {
            html = `<div><pre>${aiText}</pre></div>`;
        }

        res.json({
            html: html,
            raw: aiText
        });

    } catch (err) {
        console.error(err);
        res.json({ error: "サーバーエラーが発生しました。" });
    }
});


// ------------------- START ------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
