// DOM
const btnGenerateTitles = document.getElementById("btn-generate-titles");
const titlesContainer = document.getElementById("titles");
const selectedTitleInput = document.getElementById("selectedTitle");
const btnGenerateArticle = document.getElementById("btn-generate-article");
const articlePreview = document.getElementById("articlePreview"); // 非表示のHTML格納
const articleDisplay = document.getElementById("articleDisplay");   // 表示用エリア
const btnCopyHTML = document.getElementById("btn-copy-html");
const keywordInput = document.getElementById("keyword");

// -------------------------------
// タイトル生成
// -------------------------------
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

    if (!res.ok) {
      titlesContainer.innerHTML = "<div>タイトル生成に失敗しました</div>";
      return;
    }

    const data = await res.json();
    renderTitles(data.titles || []);

  } catch (e) {
    console.error("タイトル生成エラー:", e);
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

// -------------------------------
// 本文生成
// -------------------------------
btnGenerateArticle.addEventListener("click", async () => {
  const title = selectedTitleInput.value.trim();
  const keyword = keywordInput.value.trim();
  if (!title) return alert("タイトルを選択または入力してください");
  if (!keyword) return alert("キーワードを入力してください");

  btnGenerateArticle.disabled = true;
  btnGenerateArticle.textContent = "生成中...（2〜3分程度お待ちください）";
  
  // 生成中メッセージを表示
  articleDisplay.innerHTML = `
    <div style="text-align:center;padding:40px;">
      <p style="font-size:18px;color:#0b66ff;margin-bottom:10px;">🔄 記事を生成しています...</p>
      <p style="color:#6b7c93;">2〜3分程度かかります。このままお待ちください。</p>
      <div style="margin-top:20px;">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  try {
    const res = await fetch("/api/generate-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, keyword })
    });

    if (!res.ok) {
      articleDisplay.innerHTML = "<p style='color:red;'>生成に失敗しました。もう一度お試しください。</p>";
      return;
    }

    const data = await res.json();

    // HTML形式のデータを保存（非表示領域）
    articlePreview.innerHTML = data.html || "";
    
    // HTML形式のデータを表示領域にも表示
    articleDisplay.innerHTML = data.html || "<p>生成に失敗しました</p>";

    // コピー用データを保持
    btnCopyHTML.dataset.html = data.html || "";

    // 成功メッセージを一時表示
    showSuccessMessage();

  } catch (e) {
    console.error("記事生成エラー:", e);
    articleDisplay.innerHTML = "<p style='color:red;'>生成に失敗しました。もう一度お試しください。</p>";
  } finally {
    btnGenerateArticle.disabled = false;
    btnGenerateArticle.textContent = "ブログ本文を生成";
  }
});

// -------------------------------
// 成功メッセージ表示
// -------------------------------
function showSuccessMessage() {
  const msg = document.createElement("div");
  msg.style.cssText = "position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:16px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;font-weight:600;";
  msg.textContent = "✅ 記事の生成が完了しました！";
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}

// -------------------------------
// HTMLコピー機能
// -------------------------------
btnCopyHTML.addEventListener("click", async () => {
  const html = btnCopyHTML.dataset.html || "";
  if (!html) return alert("HTMLがありません。記事を生成してください。");
  
  try {
    await navigator.clipboard.writeText(html);
    
    // コピー成功のフィードバック
    const originalText = btnCopyHTML.textContent;
    btnCopyHTML.textContent = "✅ コピーしました！";
    btnCopyHTML.style.background = "#10b981";
    btnCopyHTML.style.color = "white";
    btnCopyHTML.style.border = "none";
    
    setTimeout(() => {
      btnCopyHTML.textContent = originalText;
      btnCopyHTML.style.background = "";
      btnCopyHTML.style.color = "";
      btnCopyHTML.style.border = "";
    }, 2000);
    
  } catch (e) {
    alert("コピーに失敗しました: " + e.message);
  }
});
