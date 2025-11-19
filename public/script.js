// -----------------------------
// タイトル生成
// -----------------------------
async function generateTitles() {
  const keyword = document.getElementById("keywordInput").value.trim();
  if (!keyword) return alert("キーワードを入力してください");

  const response = await fetch("/api/titles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword })
  });

  const data = await response.json();
  const list = document.getElementById("titleList");
  list.innerHTML = "";

  if (!data.titles || data.titles.length === 0) {
    list.innerHTML = "<p>タイトルが生成できませんでした。</p>";
    return;
  }

  data.titles.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "title-btn";
    btn.textContent = t;

    btn.onclick = () => {
      document.getElementById("selectedTitle").value = t;
    };
    list.appendChild(btn);
  });
}

// -----------------------------
// 記事生成
// -----------------------------
async function generateArticle() {
  const keyword = document.getElementById("keywordInput").value.trim();
  const title = document.getElementById("selectedTitle").value.trim();
  const tone = document.getElementById("toneSelect").value;

  if (!keyword) return alert("キーワードが必要です");
  if (!title) return alert("タイトルを選択するか入力してください");

  const response = await fetch("/api/article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, tone, title })
  });

  const data = await response.json();
  document.getElementById("articleOutput").value = data.markdown || "生成に失敗しました";
}
