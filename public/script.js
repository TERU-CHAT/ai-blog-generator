// script.js（完全安定版 + 15000トークン対応 + タイトル候補安定 + 非表示処理）

const generateBtn = document.getElementById("generateBtn");
const loading = document.getElementById("loading");
const resultArea = document.getElementById("result");

// 「生成テキスト（改行は1文ごと）」を完全に非表示
const hiddenTextBlock = document.getElementById("generatedText");
if (hiddenTextBlock) hiddenTextBlock.style.display = "none";

async function generateArticle() {
    const keyword = document.getElementById("keyword").value.trim();

    if (!keyword) {
        alert("キーワードを入力してください。");
        return;
    }

    loading.style.display = "flex";
    resultArea.innerHTML = "";

    try {
        const response = await fetch("/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ keyword })
        });

        // ※ 404やサーバーエラーはここで検知
        if (!response.ok) {
            resultArea.innerHTML = `<p style="color:red;">サーバーエラーが発生しました (HTTP ${response.status})</p>`;
            loading.style.display = "none";
            return;
        }

        // JSONとしてパース（HTML返り対策の二段構え）
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            resultArea.innerHTML = `<p style="color:red;">サーバーから不正なレスポンスが返りました。（JSON解析失敗）</p>`;
            loading.style.display = "none";
            return;
        }

        if (data.error) {
            resultArea.innerHTML = `<p style="color:red;">${data.error}</p>`;
            loading.style.display = "none";
            return;
        }

        // 生成結果（プレビュー）のみ表示
        resultArea.innerHTML = data.html || "<p>生成された記事が空です。</p>";

    } catch (err) {
        resultArea.innerHTML = `<p style="color:red;">通信エラーが発生しました: ${err.message}</p>`;
    } finally {
        loading.style.display = "none";
    }
}

generateBtn.addEventListener("click", generateArticle);
