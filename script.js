const keywordInput = document.getElementById("keyword");
const toneSelect = document.getElementById("tone");
const generateTitlesBtn = document.getElementById("generateTitlesBtn");
const titlesLoading = document.getElementById("titlesLoading");
const titlesArea = document.getElementById("titlesArea");
const selectedTitleInput = document.getElementById("selectedTitle");
const generateArticleBtn = document.getElementById("generateArticleBtn");
const articleLoading = document.getElementById("articleLoading");
const issuesBox = document.getElementById("issues");
const markdownOutput = document.getElementById("markdownOutput");
const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
const copyHtmlBtn = document.getElementById("copyHtmlBtn");

let latestHtml = "";

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function setIssues(msgs) {
  if (!msgs || msgs.length === 0) {
    issuesBox.classList.add("hidden");
    issuesBox.innerHTML = "";
    return;
  }
  issuesBox.classList.remove("hidden");
  issuesBox.innerHTML = msgs.map(m => `<div>・${m}</div>`).join("");
}

generateTitlesBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  const tone = toneSelect.value;

  if (!keyword) return alert("キーワードを入力してください");

  generateTitlesBtn.disabled = true;
  titlesLoading.classList.remove("hidden");
  setIssues([]);

  try {
    const res = await fetch("/api/titles", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ keyword, tone })
    });

    const text = await res.text();
    const data = safeJSON(text);

    if (!data) return setIssues(["API 応答が不正です（JSONではありません）"]);
    if (data.error) return setIssues([data.error]);

    const titles = data.titles || [];
    titlesArea.innerHTML = "";

    titles.forEach(t => {
      const card = document.createElement("div");
      card.className = "title-card";
      card.textContent = t;
      card.addEventListener("click", () => {
        selectedTitleInput.value = t;
        generateArticleBtn.disabled = false;
      });
      titlesArea.appendChild(card);
    });

  } catch (_) {
    setIssues(["通信エラー"]);
  } finally {
    titlesLoading.classList.add("hidden");
    generateTitlesBtn.disabled = false;
  }
});

generateArticleBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  const tone = toneSelect.value;
  const title = selectedTitleInput.value.trim();

  if (!keyword || !title) return alert("キーワードまたはタイトルが不足しています");

  generateArticleBtn.disabled = true;
  articleLoading.classList.remove("hidden");
  setIssues([]);

  try {
    const res = await fetch("/api/article", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ keyword, tone, title })
    });

    const text = await res.text();
    const data = safeJSON(text);

    if (!data) return setIssues(["API 応答が不正です"]);
    if (data.error) return setIssues([data.error]);

    markdownOutput.value = data.markdown;
    latestHtml = data.html;

  } catch (_) {
    setIssues(["通信エラー"]);
  } finally {
    articleLoading.classList.add("hidden");
    generateArticleBtn.disabled = false;
  }
});

copyMarkdownBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(markdownOutput.value || "");
  alert("Markdownをコピーしました");
});

copyHtmlBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(latestHtml || "");
  alert("HTMLをコピーしました");
});
