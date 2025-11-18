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

// ---------- 共通 ----------
function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function setIssues(messages = []) {
  if (messages.length === 0) {
    issuesBox.classList.add("hidden");
    issuesBox.innerHTML = "";
    return;
  }
  issuesBox.classList.remove("hidden");
  issuesBox.innerHTML = messages.map(m => `<div>・${m}</div>`).join("");
}

// ---------- タイトル生成 ----------
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, tone }),
    });

    const txt = await res.text();
    const data = safeJSON(txt);

    if (!data) return setIssues(["API応答がJSONではありません"]);

    if (data.error) {
      setIssues([data.error]);
      return;
    }

    const titles = data.titles || [];
    if (titles.length === 0) return setIssues(["タイトル候補なし"]);

    titlesArea.classList.remove("empty");
    titlesArea.innerHTML = "";

    titles.forEach((title) => {
      const card = document.createElement("label");
      card.className = "title-card";
      card.innerHTML = `
        <input type="radio" name="titleOption" class="title-radio" value="${title}">
        <div class="title-text">${title}</div>
      `;
      card.addEventListener("click", () => {
        selectedTitleInput.value = title;
        generateArticleBtn.disabled = false;
      });
      titlesArea.appendChild(card);
    });

    selectedTitleInput.value = titles[0];
    generateArticleBtn.disabled = false;

  } catch (e) {
    setIssues(["通信エラー"]);
  } finally {
    titlesLoading.classList.add("hidden");
    generateTitlesBtn.disabled = false;
  }
});

// ---------- 記事生成 ----------
generateArticleBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  const tone = toneSelect.value;
  const title = selectedTitleInput.value.trim();

  if (!keyword || !title) return alert("キーワード/タイトル不足");

  generateArticleBtn.disabled = true;
  articleLoading.classList.remove("hidden");
  setIssues([]);

  try {
    const res = await fetch("/api/article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, tone, title }),
    });

    const txt = await res.text();
    const data = safeJSON(txt);

    if (!data) return setIssues(["API応答がJSONではありません"]);
    if (data.error) return setIssues([data.error]);

    markdownOutput.value = data.markdown || "";
    latestHtml = data.html || "";

  } catch (e) {
    setIssues(["通信エラー"]);
  } finally {
    articleLoading.classList.add("hidden");
    generateArticleBtn.disabled = false;
  }
});

// ---------- コピー ----------
copyMarkdownBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(markdownOutput.value || "");
  alert("Markdownコピー完了");
});

copyHtmlBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(latestHtml || "");
  alert("HTMLコピー完了");
});
