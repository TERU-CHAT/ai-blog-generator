// DOM
const btnGenerateTitles = document.getElementById("btn-generate-titles");
const titlesContainer = document.getElementById("titles");
const selectedTitleInput = document.getElementById("selectedTitle");
const btnGenerateArticle = document.getElementById("btn-generate-article");
const articlePreview = document.getElementById("articlePreview");
const articleTextArea = document.getElementById("articleText");
const btnCopyHTML = document.getElementById("btn-copy-html");
const btnCopyText = document.getElementById("btn-copy-text");
const keywordInput = document.getElementById("keyword");

// -----------------------------
// Loading UI helper
// -----------------------------
function showLoading(btn, msg = "生成中...") {
  btn.disabled = true;
  btn.dataset.originalText = btn.textContent;
  btn.textContent = msg;
}

function hideLoading(btn) {
  btn.disabled = false;
  btn.textContent = btn.dataset.originalText;
}

// -----------------------------
// タイトル生成
// -----------------------------
btnGenerateTitles.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) return alert("キーワードを入力してください");

  titlesContainer.innerHTML = "<div class='loading'>AIが生成中です...</div>";
  showLoading(btnGenerateTitles, "生成中...");

  try {
    const res = await fetch("/api/generate-titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword })
    });

    const data = await res.json();
    hideLoading(btnGenerateTitles);

    if (!data.titles) {
      titlesContainer.innerHTML = "タイトル生成に失敗しました";
      return;
    }

    titlesContainer.innerHTML = "";
    data.titles.forEach((t) => {
      const card = document.createElement("div");
      card.className = "title-card";
      card.textContent = t;
      card.onclick = () => (selectedTitleInput.value = t);
      titlesContainer.appendChild(card);
    });
  } catch (e) {
    hideLoading(btnGenerateTitles);
    titlesContainer.innerHTML = "<div>エラーが発生しました</div>";
  }
});

// -----------------------------
// 記事生成
// -----------------------------
btnGenerateArticle.addEventListener("click", async () => {
  const title = selectedTitleInput.value.trim();
  const keyword = keywordInput.value.trim();
  if (!title) return alert("タイトルが空です");
  if (!keyword) return alert("キーワードが空です");

  showLoading(btnGenerateArticle, "AIが長文記事を生成中...(30-60秒)");

  try {
    const res = await fetch("/api/generate-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, keyword })
    });

    const data = await res.json();
    hideLoading(btnGenerateArticle);

    if (!data.html) {
      articlePreview.innerHTML = "<p>生成失敗（HTMLなし）</p>";
      articleTextArea.value = data.text || "";
      return;
    }

    articlePreview.innerHTML = data.html;
    articleTextArea.value = data.text;
  } catch (e) {
    hideLoading(btnGenerateArticle);
    articlePreview.innerHTML = "<p>生成時にエラー</p>";
  }
});

// -----------------------------
// コピー
// -----------------------------
btnCopyHTML.onclick = () => navigator.clipboard.writeText(articlePreview.innerHTML);
btnCopyText.onclick = () => navigator.clipboard.writeText(articleTextArea.value);
