const keywordInput = document.getElementById("keyword");
const toneSelect = document.getElementById("tone");
const generateTitlesBtn = document.getElementById("generateTitlesBtn");
const titlesLoading = document.getElementById("titlesLoading");
const titlesArea = document.getElementById("titlesArea");
const selectedTitleInput = document.getElementById("selectedTitle");
const generateArticleBtn = document.getElementById("generateArticleBtn");
const articleLoading = document.getElementById("articleLoading");
const markdownOutput = document.getElementById("markdownOutput");
const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
const copyHtmlBtn = document.getElementById("copyHtmlBtn");

// ★ issuesBoxがnull対策
const issuesBox = document.getElementById("issues") || (() => {
  const div = document.createElement("div");
  div.id = "issues";
  div.className = "issues hidden";
  document.body.appendChild(div);
  return div;
})();

let latestHtml = "";

// JSON安全パース
function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function setIssues(list) {
  if (!list || list.length === 0) {
    issuesBox.classList.add("hidden");
    issuesBox.innerHTML = "";
    return;
  }
  issuesBox.classList.remove("hidden");
  issuesBox.innerHTML = list.map(m => `<div>・${m}</div>`).join("");
}

// ------------- タイトル生成 -------------
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
      body: JSON.stringify({ keyword, tone })
    });

    const text = await res.text();

    // HTML応答なら404エラー
    if (text.startsWith("<")) {
      setIssues(["titles API が 404 です。Vercel の API 配置を確認してください。"]);
      return;
    }

    const data = safeJSON(text);
    if (!data) return setIssues(["titles API が JSON を返していません"]);

    if (data.error) return setIssues([data.error]);

    const titles = data.titles || [];
    if (titles.length === 0) return setIssues(["タイトル候補がありません"]);

    titlesArea.classList.remove("empty");
    titlesArea.innerHTML = "";

    titles.forEach((title) => {
      const card = document.createElement("label");
      card.className = "title-card";
      card.innerHTML = `
        <input type="radio" name="title" value="${title}">
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

  } catch {
    setIssues(["通信エラーが発生しました"]);
  } finally {
    titlesLoading.classList.add("hidden");
    generateTitlesBtn.disabled = false;
  }
});

// ------------- 記事生成 -------------
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

    // HTML応答なら404
    if (text.startsWith("<")) {
      setIssues(["article API が 404 です。配置を確認してください。"]);
      return;
    }

    const data = safeJSON(text);
    if (!data) {
      setIssues(["API応答がJSONではありません"]);
      return;
    }

    if (data.error) {
      setIssues([data.error]);
      return;
    }

    markdownOutput.value = data.markdown || "";
    latestHtml = data.html || "";

  } catch {
    setIssues(["通信エラー"]);
  } finally {
    articleLoading.classList.add("hidden");
    generateArticleBtn.disabled = false;
  }
});

// ------------- コピー -------------
copyMarkdownBtn.addEventListener("click", () => {
  if (!markdownOutput.value) return alert("コピーするものがありません");
  navigator.clipboard.writeText(markdownOutput.value);
  alert("Markdownコピー完了");
});

copyHtmlBtn.addEventListener("click", () => {
  if (!latestHtml) return alert("HTMLがありません");
  navigator.clipboard.writeText(latestHtml);
  alert("HTMLコピー完了");
});
