const generateBtn = document.getElementById("generateBtn");
const loading = document.getElementById("loading");
const resultArea = document.getElementById("result");

// 非表示にする（生成テキスト）
const hiddenTextBlock = document.getElementById("generatedText");
if (hiddenTextBlock) hiddenTextBlock.style.display = "none";

async function generateArticle() {
    const keyword = document.getElementById("keyword").value.trim();
    if (!keyword) {
        alert("キーワードを入力してください。");
        return;
    }

    loading.style.display = "block";
    resultArea.innerHTML = "";

    try {
        const response = await fetch("/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ keyword })
        });

        if (!response.ok) {
            resultArea.innerHTML = "<p style='color:red;'>サーバーエラーが発生しました。</p>";
            loading.style.display = "none";
            return;
        }

        // JSONパースエラー対策
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            resultArea.innerHTML = "<p style='color:red;'>HTMLが返されました（JSONパースエラー）。server.js のレスポンス形式を確認してください。</p>";
            loading.style.display = "none";
            return;
        }

        if (data.error) {
            resultArea.innerHTML = `<p style='color:red;'>${data.error}</p>`;
            loading.style.display = "none";
            return;
        }

        // 生成結果のみ表示
        resultArea.innerHTML = data.html || "<p>生成された内容を表示できません。</p>";

    } catch (e) {
        resultArea.innerHTML = `<p style='color:red;'>通信エラー: ${e.message}</p>`;

    } finally {
        loading.style.display = "none";
    }
}

generateBtn.addEventListener("click", generateArticle);
