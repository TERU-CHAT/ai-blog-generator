// DOM
const btnGenerateTitles = document.getElementById("btn-generate-titles");
const titlesContainer = document.getElementById("titles");
const selectedTitleInput = document.getElementById("selectedTitle");
const btnGenerateArticle = document.getElementById("btn-generate-article");
const articleTextArea = document.getElementById("articleText"); // テキストプレビュー（表示）
const btnCopyHTML = document.getElementById("btn-copy-html");
const btnCopyText = document.getElementById("btn-copy-text");
const keywordInput = document.getElementById("keyword");

// --- タイトル生成（既存ロジック維持） ---
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

// --- 本文生成（テキストのみ画面表示） ---
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

    // Check HTTP
    if (!res.ok) {
      const txt = await res.text();
      articleTextArea.value = `サーバーエラー: HTTP ${res.status}\n\n${txt}`;
      return;
    }

    const data = await res.json();

    // 表示は「text」優先。なければ html をテキスト化して表示
    if (data.text && data.text.trim()) {
      articleTextArea.value = data.text;
    } else if (data.html && data.html.trim()) {
      // 非表示の HTML はコピー用に保持するが、表示はテキスト化
      articleTextArea.value = stripHtml(data.html);
    } else {
      articleTextArea.value = data.raw || "生成結果が取得できませんでした。";
    }

    // 内部コピー用に html を data属性で保持しておく（ボタンで利用）
    btnCopyHTML.dataset.html = data.html || "";
    btnCopyText.dataset.text = data.text || articleTextArea.value || "";

  } catch (e) {
    console.error(e);
    articleTextArea.value = "生成に失敗しました。通信エラーが発生しました。";
  } finally {
    btnGenerateArticle.disabled = false;
    btnGenerateArticle.textContent = "ブログ本文を生成";
  }
});

// --- コピー機能（HTML / テキスト） ---
btnCopyHTML.addEventListener("click", async () => {
  const html = btnCopyHTML.dataset.html || "";
  if (!html) return alert("HTMLがまだありません。記事を生成してください。");
  try {
    await navigator.clipboard.writeText(html);
    alert("HTML をクリップボードにコピーしました");
  } catch {
    alert("HTML のコピーに失敗しました");
  }
});

btnCopyText.addEventListener("click", async () => {
  const txt = btnCopyText.dataset.text || articleTextArea.value || "";
  if (!txt) return alert("テキストがまだありません。記事を生成してください。");
  try {
    await navigator.clipboard.writeText(txt);
    alert("テキストをクリップボードにコピーしました");
  } catch {
    alert("テキストのコピーに失敗しました");
  }
});

// ヘルパー: HTML をテキスト化（非常に簡易）
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.innerText;
}
