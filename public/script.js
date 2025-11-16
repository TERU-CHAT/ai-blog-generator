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

function setIssues(messages) {
  if (!messages || messages.length === 0) {
    issuesBox.classList.add("hidden");
    issuesBox.innerHTML = "";
    return;
  }
  issuesBox.classList.remove("hidden");
  issuesBox.innerHTML = messages.map(m => `<div>・${m}</div>`).join("");
}

generateTitlesBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  const tone = toneSelect.value;

  if (!keyword) {
    alert("キーワードを入力してください。");
    return;
  }

  generateTitlesBtn.disabled = true;
  titlesLoading.classList.remove("hidden");
  setIssues([]);
  titlesArea.classList.add("empty");
  titlesArea.innerHTML = '<p class="placeholder">タイトル候補を生成中です...</p>';
  generateArticleBtn.disabled = true;
  selectedTitleInput.value = "";
  markdownOutput.value = "";
  latestHtml = "";

  try {
    const res = await fetch("/api/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, tone })
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("JSON parse error (titles):", text);
      setIssues(["タイトル生成APIの応答を解析できませんでした。"]);
      return;
    }

    if (!res.ok || data.error) {
      setIssues([data.error || "タイトル生成APIでエラーが発生しました。"]);
      return;
    }

    const titles = Array.isArray(data.titles) ? data.titles : [];
    if (titles.length === 0) {
      setIssues(["タイトル候補が取得できませんでした。"]);
      return;
    }

    titlesArea.classList.remove("empty");
    titlesArea.innerHTML = "";
    titles.forEach((title, idx) => {
      const card = document.createElement("label");
      card.className = "title-card";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "titleOption";
      radio.className = "title-radio";
      radio.value = title;
      if (idx === 0) radio.checked = true;

      const span = document.createElement("div");
      span.className = "title-text";
      span.textContent = title;

      card.appendChild(radio);
      card.appendChild(span);
      titlesArea.appendChild(card);

      card.addEventListener("click", () => {
        selectedTitleInput.value = title;
        generateArticleBtn.disabled = false;
      });
    });

    selectedTitleInput.value = titles[0];
    generateArticleBtn.disabled = false;
    setIssues([]);

  } catch (e) {
    console.error(e);
    setIssues(["ネットワークエラーによりタイトル候補の取得に失敗しました。"]);
  } finally {
    titlesLoading.classList.add("hidden");
    generateTitlesBtn.disabled = false;
  }
});

generateArticleBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  const tone = toneSelect.value;
  const title = selectedTitleInput.value.trim();

  if (!keyword) {
    alert("キーワードを入力してください。");
    return;
  }
  if (!title) {
    alert("使用するブログタイトルを入力してください。");
    return;
  }

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
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("JSON parse error (article):", text);
      setIssues(["記事生成APIの応答を解析できませんでした。"]);
      return;
    }

    if (!res.ok || data.error) {
      setIssues([data.error || "記事生成APIでエラーが発生しました。"]);
      return;
    }

    markdownOutput.value = data.markdown || "";
    latestHtml = data.html || "";
    if (!markdownOutput.value) {
      setIssues(["Markdown形式の記事が生成されませんでした。"]);
    } else {
      setIssues([]);
    }

  } catch (e) {
    console.error(e);
    setIssues(["ネットワークエラーにより記事生成に失敗しました。"]);
  } finally {
    articleLoading.classList.add("hidden");
    generateArticleBtn.disabled = false;
  }
});

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("クリップボードにコピーしました。");
  } catch (e) {
    console.error(e);
    alert("コピーに失敗しました。テキストを手動で選択してください。");
  }
}

copyMarkdownBtn.addEventListener("click", () => {
  const text = markdownOutput.value;
  if (!text) {
    alert("コピーするMarkdownがありません。");
    return;
  }
  copyToClipboard(text);
});

copyHtmlBtn.addEventListener("click", () => {
  if (!latestHtml) {
    alert("コピーするHTMLがありません。まず記事を生成してください。");
    return;
  }
  copyToClipboard(latestHtml);
});
