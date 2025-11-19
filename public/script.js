document.getElementById("generateBtn").addEventListener("click", async () => {
  const keyword = document.getElementById("keyword").value;
  const resultArea = document.getElementById("result");
  resultArea.innerHTML = "";

  if (!keyword.trim()) {
    alert("キーワードを入力してください");
    return;
  }

  resultArea.innerHTML = "<li>生成中...</li>";

  try {
    const response = await fetch("/api/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword })
    });

    const data = await response.json();

    if (data.error) {
      resultArea.innerHTML = `<li>エラー: ${JSON.stringify(data.error)}</li>`;
      return;
    }

    resultArea.innerHTML = "";
    data.titles.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      resultArea.appendChild(li);
    });
  } catch (err) {
    resultArea.innerHTML = `<li>通信エラー: ${err}</li>`;
  }
});
