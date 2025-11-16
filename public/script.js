const keywordInput = document.getElementById("keyword");
const toneSelect = document.getElementById("tone");
const generateTitlesBtn = document.getElementById("generateTitlesBtn");
const titlesLoading = document.getElementById("titlesLoading");
const titlesArea = document.getElementById("titlesArea");
const selectedTitleInput = document.getElementById("selectedTitle");
const generateArticleBtn = document.getElementById("generateArticleBtn");
const markdownOutput = document.getElementById("markdownOutput");
const articleLoading = document.getElementById("articleLoading");

let latestHtml = "";

// ---------------------------------------------------
// タイトル生成
// ---------------------------------------------------
generateTitlesBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  const tone = toneSelect.value;

  if (!keyword) {
    alert("キーワードを入力してください");
    return;
  }

  titlesLoading.classList.remove("hidden");
  titlesArea.innerHTML = "<p>生成中...</p>";

  try {
    const res = await fetch("/api/titles", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ keyword, tone })
    });

    if (!res.ok) throw new Error("APIエラー（titles）");

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("JSON解析に失敗（HTMLが返ってきた可能性）");
    }

    if (!data.titles) throw new Error("タイトル配列がありません");

    titlesArea.innerHTML = "";
    data.titles.forEach(t => {
      const btn = document.createElement("button");
      btn.textContent = t;
      btn.className = "title-card";
      btn.onclick = () => {
        selectedTitleInput.value = t;
        generateArticleBtn.disabled = false;
      };
      titlesArea.appendChild(btn);
    });

  } catch (err) {
    titlesArea.innerHTML = `<p style="color:red">${err.message}</p>`;
  }

  titlesLoading.classList.add("hidden");
});

// ---------------------------------------------------
// 記事生成
// ---------------------------------------------------
generateArticleBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  const tone = toneSelect.value;
  const title = selectedTitleInput.value.trim();

  if (!keyword || !title) {
    alert("キーワードとタイトルが必要です");
    return;
  }

  articleLoading.classList.remove("hidden");

  try {
    const res = await fetch("/api/article", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ keyword, tone, title })
    });

    if (!res.ok) throw new Error("APIエラー（article）");

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("JSON解析に失敗（HTMLが返ってきた可能性）");
    }

    markdownOutput.value = data.markdown || "";
    latestHtml = data.html || "";

  } catch (err) {
    markdownOutput.value = `エラー: ${err.message}`;
  }

  articleLoading.classList.add("hidden");
});

// ---------------------------------------------------
// コピー
// ---------------------------------------------------
document.getElementById("copyMarkdownBtn").onclick = () => {
  navigator.clipboard.writeText(markdownOutput.value);
  alert("Markdownをコピーしました");
};

document.getElementById("copyHtmlBtn").onclick = () => {
  navigator.clipboard.writeText(latestHtml);
  alert("HTMLをコピーしました");
};
