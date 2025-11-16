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

// ---------- ユーティリティ ----------
function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON parse error:", text);
    return null;
  }
}

function setIssues(messages) {
  if (!messages || messages.length === 0) {
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

  if (!keyword) return alert("キーワードを入力してください。");

  generateTitlesBtn.disabled = true;
  titlesLoading.classList.remove("hidden");
  setIssues([]);

  try {
    const res = await fetch("/api/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, tone })
    });

    const text = await res.text();
    const data = safeJSON(text);

    if (!data) {
      setIssues(["API 応答が不正です（JSONではありません）"]);
      return;
    }

    if (data.error) {
      setIssues([data.error]);
      return;
    }

    const titles = data.titles || [];
    if (titles.length === 0) {
      setIssues(["タイトル候補がありません"]);
      return;
    }

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
    setIssues(["通信エラーが発生しました"]);
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

  if (!keyword) return alert("キーワードがありません");
  if (!title) return alert("タイトルがありません");

  generateArticleBtn.disabled = true;
  articleLoading.classList.remove("hidden");
  setIssues([]);

  try {
    const res = await fetch("/api/article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, tone, title })
    });

    const text = await res.text();
    const data = safeJSON(text);

    if (!data) {
      setIssues(["API 応答が不正です（JSONではありません）"]);
      return;
    }

    if (data.error) {
      setIssues([data.error]);
      return;
    }

    markdownOutput.value = data.markdown || "";
    latestHtml = data.html || "";

  } catch (e) {
    setIssues(["通信エラーが発生しました"]);
  } finally {
    articleLoading.classList.add("hidden");
    generateArticleBtn.disabled = false;
  }
});

// ---------- コピー ----------
copyMarkdownBtn.addEventListener("click", () => {
  if (!markdownOutput.value) return alert("コピーするMarkdownがありません");
  navigator.clipboard.writeText(markdownOutput.value);
  alert("Markdownをコピーしました");
});

copyHtmlBtn.addEventListener("click", () => {
  if (!latestHtml) return alert("コピーするHTMLがありません");
  navigator.clipboard.writeText(latestHtml);
  alert("HTMLをコピーしました");
});
