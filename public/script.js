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
    const data = await res.json();
    renderTitles(data.titles || []);
  } catch (e) {
    console.error(e);
    titlesContainer.innerHTML = "<div>エラーが発生しました</div>";
  }
});

function renderTitles(titles) {
  titlesContainer.innerHTML = "";
  titles.forEach((t) => {
    const card = document.createElement("div");
    card.className = "title-card";
    card.textContent = t || "";
    card.addEventListener("click", () => {
      selectedTitleInput.value = t;
    });
    titlesContainer.appendChild(card);
  });
}

// 本文生成
btnGenerateArticle.addEventListener("click", async () => {
  const title = selectedTitleInput.value.trim();
  const keyword = keywordInput.value.trim();
  if (!title) return alert("タイトルを選択または入力してください");
  if (!keyword) return alert("キーワードを入力してください");

  // UX
  btnGenerateArticle.disabled = true;
  btnGenerateArticle.textContent = "生成中...（数秒〜数十秒かかります）";

  try {
    const res = await fetch("/api/generate-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, keyword })
    });
    const data = await res.json();

    // HTML プレビュー
    articlePreview.innerHTML = data.html || "<p>HTMLが取得できませんでした</p>";
    // テキスト表示
    articleTextArea.value = data.text || (data.html ? stripHtml(data.html) : "");

  } catch (e) {
    console.error(e);
    articlePreview.innerHTML = "<p>生成に失敗しました</p>";
    articleTextArea.value = "";
  } finally {
    btnGenerateArticle.disabled = false;
    btnGenerateArticle.textContent = "ブログ本文を生成";
  }
});

// コピー機能
btnCopyHTML.addEventListener("click", async () => {
  const html = articlePreview.innerHTML;
  try {
    await navigator.clipboard.writeText(html);
    alert("HTML をクリップボードにコピーしました");
  } catch {
    alert("コピーに失敗しました");
  }
});
btnCopyText.addEventListener("click", async () => {
  const txt = articleTextArea.value;
  try {
    await navigator.clipboard.writeText(txt);
    alert("テキストをクリップボードにコピーしました");
  } catch {
    alert("コピーに失敗しました");
  }
});

// ヘルパー: HTML をテキスト化（非常に簡易）
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.innerText;
}
