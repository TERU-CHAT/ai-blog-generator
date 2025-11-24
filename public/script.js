// =====================
// script.js（完全リセット版）
// =====================

const btnGenerateTitles = document.getElementById("btn-generate-titles");
const titlesContainer = document.getElementById("titles");
const selectedTitleInput = document.getElementById("selectedTitle");
const btnGenerateArticle = document.getElementById("btn-generate-article");
const articlePreview = document.getElementById("articlePreview");
const keywordInput = document.getElementById("keyword");

// タイトル生成
btnGenerateTitles.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) return alert("キーワードを入力してください（空白区切りで複数可）");

  titlesContainer.innerHTML = "<div>生成中...</div>";

  try {
    const res = await fetch("/api/generate-titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword })
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    renderTitles(data.titles || []);

  } catch(e) {
    console.error(e);
    titlesContainer.innerHTML = "<div>タイトル生成に失敗しました</div>";
  }
});

function renderTitles(titles) {
  titlesContainer.innerHTML = "";
  titles.forEach(t => {
    const card = document.createElement("div");
    card.className = "title-card";
    card.textContent = t;
    card.addEventListener("click", () => { selectedTitleInput.value = t; });
    titlesContainer.appendChild(card);
  });
}

// 記事生成
btnGenerateArticle.addEventListener("click", async () => {
  const title = selectedTitleInput.value.trim();
  const keyword = keywordInput.value.trim();
  if (!title) return alert("タイトルを選択または入力してください");
  if (!keyword) return alert("キーワードを入力してください");

  btnGenerateArticle.disabled = true;
  btnGenerateArticle.textContent = "生成中...（数秒〜数十秒かかります）";
  articlePreview.innerHTML = "<div>読み込み中...</div>";

  try {
    const res = await fetch("/api/generate-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, keyword })
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    articlePreview.innerHTML = data.html || "<p>記事生成に失敗しました</p>";

  } catch(e) {
    console.error(e);
    articlePreview.innerHTML = `<p>記事生成中にエラーが発生しました: ${e.message}</p>`;
  } finally {
    btnGenerateArticle.disabled = false;
    btnGenerateArticle.textContent = "ブログ本文を生成";
  }
});
