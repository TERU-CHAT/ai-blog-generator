// タイトル生成
document.getElementById("btn-generate-titles").addEventListener("click", async () => {
  const keyword = document.getElementById("keyword").value.trim();
  if (!keyword) return alert("キーワードを入力してください");

  const res = await fetch("/api/generate-titles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword }),
  });

  const data = await res.json();

  const area = document.getElementById("titles");
  area.innerHTML = "";

  data.titles.forEach((t) => {
    const btn = document.createElement("button");
    btn.textContent = t;
    btn.addEventListener("click", () => {
      document.getElementById("selectedTitle").value = t;
    });
    area.appendChild(btn);
  });
});

// 本文生成
document.getElementById("btn-generate-article").addEventListener("click", async () => {
  const title = document.getElementById("selectedTitle").value.trim();
  const keyword = document.getElementById("keyword").value.trim();

  if (!title) return alert("タイトルを入力または選択してください");

  const res = await fetch("/api/generate-article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, keyword }),
  });

  const data = await res.json();
  document.getElementById("article").value = data.article;
});
