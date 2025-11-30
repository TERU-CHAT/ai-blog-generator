import React, { useState } from 'react';
import { FileText, Sparkles, Download, Copy, Check, Key } from 'lucide-react';

export default function AIBlogGenerator() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const [keywords, setKeywords] = useState('');
  const [step, setStep] = useState('input');
  const [titles, setTitles] = useState([]);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [article, setArticle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [outputFormat, setOutputFormat] = useState('text');

  const saveApiKey = () => {
    if (apiKey.trim()) {
      setShowApiKeyInput(false);
      alert('APIキーを設定しました。記事生成を開始できます。');
    } else {
      alert('APIキーを入力してください');
    }
  };

  const generateTitles = async () => {
    if (!keywords.trim()) {
      alert('キーワードを入力してください');
      return;
    }

    if (!apiKey) {
      alert('APIキーが設定されていません');
      setShowApiKeyInput(true);
      return;
    }

    setIsGenerating(true);
    setStep('titles');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: [
            {
              type: 'text',
              text: 'あなたはSEO検定1級合格者です。検索意図を捉え、クリック率を高める魅力的なブログタイトルを提案する専門家です。',
              cache_control: { type: 'ephemeral' }
            }
          ],
          messages: [{
            role: 'user',
            content: `以下のキーワードを基に、SEOに最適化された魅力的なブログタイトルを5つ提案してください。

キーワード: ${keywords.trim().split(/\s+/).join(', ')}

要件:
- 検索意図を捉えたタイトル
- クリック率を高める魅力的な表現
- 適切な文字数（30-40文字程度）
- キーワードを自然に含める

JSON形式で以下のように返してください（他のテキストは一切含めないでください）:
{"titles": ["タイトル1", "タイトル2", "タイトル3", "タイトル4", "タイトル5"]}`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content.find(c => c.type === 'text')?.text || '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setTitles(parsed.titles);
    } catch (error) {
      console.error('タイトル生成エラー:', error);
      alert('タイトルの生成に失敗しました。APIキーが正しいか確認してください。');
      setStep('input');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateArticle = async (title) => {
    setSelectedTitle(title);
    setStep('generating');
    setIsGenerating(true);

    try {
      const systemPrompt = `あなたはSEO検定1級合格者として、高品質なブログ記事を執筆します。

【記事執筆の基本要件】
- 最低3000文字以上
- 導入文: 500文字以上（見出しなし、「導入文」という文言も不要、タイトルの直後に本文を書く）
- 見出しH2: 5個以上（各見出しは具体的で魅力的に）
- 見出しH3: 各H2の配下に3つ以上（合計15個以上）
- 各H3の本文: 300文字以上
- まとめ: 500文字以上（必須・SEO対策として最重要）
- 口調: 読者に語りかけるような優しく親しみやすい口調
- SEO最適化: キーワードを自然に配置、E-E-A-T（経験・専門性・権威性・信頼性）を意識

【重要】文章の書き方ルール:
- 同じ語尾を連続して使用しないこと
- 「〜です。〜です。」「〜ます。〜ます。」のような連続は避ける
- 語尾のバリエーション例:
  * 「〜です」→「〜でしょう」「〜ですね」「〜なんです」
  * 「〜ます」→「〜ましょう」「〜ますね」「〜ませんか」
  * 体言止め、疑問形、倒置法なども活用
- 文章にリズムと変化をつけて、読みやすさを向上させる

【記事構成のテンプレート】
# タイトル

（導入文500文字以上。見出しなし、「導入文」という文言も不要）

## H2見出し1（具体的な見出し名）
### H3見出し1-1
（300文字以上の本文）

### H3見出し1-2
（300文字以上の本文）

### H3見出し1-3
（300文字以上の本文）

（H2見出しを5個以上、各H2配下にH3を3つ以上作成）

## まとめ
（500文字以上の本文を必ず記載。記事の要点を整理し、読者に行動を促す内容）

【絶対厳守】
1. 「## まとめ」セクションは必ず最後に含めること
2. まとめの本文は500文字以上必須
3. 導入文には見出しをつけない
4. 「導入文」という文言は使わない
5. 記事を途中で終わらせず、必ず「## まとめ」まで完全に書き切ること`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10000,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' }
            }
          ],
          messages: [{
            role: 'user',
            content: `以下のタイトルとキーワードで記事を執筆してください。

タイトル: ${title}
キーワード: ${keywords}

マークダウン形式で記事全体を執筆してください。途中で途切れることなく、必ず「## まとめ」セクションまで完全に執筆してください。`
          }]
        })
      });

      const data = await response.json();
      let generatedArticle = data.content.find(c => c.type === 'text')?.text || '';
      
      if (!generatedArticle.includes('## まとめ')) {
        const summaryResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            system: [
              {
                type: 'text',
                text: 'あなたはSEO検定1級合格者として、記事の「まとめ」セクションを執筆します。500文字以上で記事全体の要点を整理し、読者に行動を促す内容を書きます。同じ語尾を連続させず（「〜です。〜です。」「〜ます。〜ます。」など）、文章にリズムと変化をつけます。',
                cache_control: { type: 'ephemeral' }
              }
            ],
            messages: [{
              role: 'user',
              content: `以下の記事の続きとして、「## まとめ」セクションを500文字以上で執筆してください。

記事タイトル: ${title}
キーワード: ${keywords}

既存の記事:
${generatedArticle}

「## まとめ」セクションのみを執筆してください。`
            }]
          })
        });
        
        const summaryData = await summaryResponse.json();
        const summary = summaryData.content.find(c => c.type === 'text')?.text || '';
        generatedArticle += '\n\n' + summary;
      } else {
        const summaryMatch = generatedArticle.match(/## まとめ[\s\S]*$/);
        if (summaryMatch) {
          const summaryContent = summaryMatch[0];
          const summaryTextOnly = summaryContent.replace(/^## まとめ\s*\n/, '').trim();
          
          if (summaryTextOnly.length < 400) {
            const continuationResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2000,
                system: [
                  {
                    type: 'text',
                    text: 'あなたはSEO検定1級合格者として、記事の「まとめ」セクションを補完します。既存のまとめの続きを自然に書き、合計500文字以上になるように執筆します。同じ語尾を連続させず（「〜です。〜です。」「〜ます。〜ます。」など）、文章にリズムと変化をつけます。',
                    cache_control: { type: 'ephemeral' }
                  }
                ],
                messages: [{
                  role: 'user',
                  content: `以下の記事の「まとめ」セクションが途中で途切れています。続きを自然に補完して、合計500文字以上の充実したまとめにしてください。

記事タイトル: ${title}
キーワード: ${keywords}

既存の記事全体:
${generatedArticle}

既存のまとめ部分が途切れているので、その続きから自然に補完してください。見出しは不要で、本文のみを追加してください。`
                }]
              })
            });
            
            const continuationData = await continuationResponse.json();
            const continuation = continuationData.content.find(c => c.type === 'text')?.text || '';
            
            generatedArticle += '\n\n' + continuation.trim();
          }
        }
      }
      
      setArticle(generatedArticle);
      setStep('result');
    } catch (error) {
      console.error('記事生成エラー:', error);
      alert('記事の生成に失敗しました。もう一度お試しください。');
      setStep('titles');
    } finally {
      setIsGenerating(false);
    }
  };

  const convertToHTML = (markdown) => {
    let html = markdown;
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.split('\n\n').map(para => {
      if (!para.trim()) return '';
      if (para.startsWith('<h')) return para;
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return html;
  };

  const getOutputContent = () => {
    if (outputFormat === 'html') {
      return convertToHTML(article);
    }
    return article;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getOutputContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadArticle = () => {
    const content = getOutputContent();
    const extension = outputFormat === 'html' ? 'html' : 'md';
    const mimeType = outputFormat === 'html' ? 'text/html' : 'text/markdown';
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTitle.substring(0, 30)}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEditing = (index) => {
    setEditingIndex(index);
    setEditingTitle(titles[index]);
  };

  const saveEdit = (index) => {
    if (editingTitle.trim()) {
      const newTitles = [...titles];
      newTitles[index] = editingTitle.trim();
      setTitles(newTitles);
    }
    setEditingIndex(null);
    setEditingTitle('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingTitle('');
  };

  const reset = () => {
    setStep('input');
    setKeywords('');
    setTitles([]);
    setSelectedTitle('');
    setArticle('');
    setEditingIndex(null);
    setEditingTitle('');
  };

  if (showApiKeyInput && !apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Key className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Claude API キーの設定</h2>
            <p className="text-gray-600 text-sm">記事生成にはClaude APIキーが必要です</p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">
              APIキーを入力
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              APIキーは https://console.anthropic.com で取得できます
            </p>
          </div>

          <button
            onClick={saveApiKey}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
          >
            設定して開始
          </button>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
            <p className="text-sm text-gray-700">
              <strong>⚠️ 注意:</strong> APIキーはブラウザのメモリにのみ保存され、サーバーには送信されません。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-12 h-12 text-indigo-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-800">AI Blog Generator</h1>
          </div>
          <p className="text-gray-600 text-lg">SEO検定1級レベルの高品質な記事を自動生成</p>
          <button
            onClick={() => setShowApiKeyInput(true)}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
          >
            APIキーを変更
          </button>
        </div>

        {step === 'input' && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <Sparkles className="w-6 h-6 text-yellow-500 mr-2" />
              キーワードを入力してください
            </h2>
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                キーワード（スペース区切りで複数入力可能）
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="例: SEO対策 ブログ運営 アクセスアップ"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none text-lg"
              />
              <p className="text-sm text-gray-500 mt-2">
                ※ メインキーワードと関連キーワードをスペース区切りで入力すると、より最適化された記事が生成されます
              </p>
            </div>
            <button
              onClick={generateTitles}
              disabled={isGenerating || !keywords.trim()}
              className="w-full bg-indigo-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  タイトル生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  タイトル案を生成
                </>
              )}
            </button>
          </div>
        )}

        {step === 'titles' && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              タイトルを選択してください
            </h2>
            <p className="text-gray-600 mb-6 text-sm">
              ※ タイトルをクリックして編集することもできます
            </p>
            <div className="space-y-4">
              {titles.map((title, index) => (
                <div key={index} className="relative">
                  {editingIndex === index ? (
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-1 px-3 py-2 border-2 border-indigo-500 rounded-lg focus:outline-none text-lg"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(index)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => generateArticle(title)}
                        disabled={isGenerating}
                        className="flex-1 text-left p-4 border-2 border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition disabled:opacity-50 flex items-start"
                      >
                        <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-gray-800 font-medium text-lg">{title}</span>
                      </button>
                      <button
                        onClick={() => startEditing(index)}
                        className="px-4 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex-shrink-0"
                      >
                        編集
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={reset}
              className="w-full mt-6 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
            >
              キーワードを変更する
            </button>
          </div>
        )}

        {step === 'generating' && (
          <div className="bg-white rounded-lg shadow-xl p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">記事を生成中...</h2>
            <p className="text-gray-600 mb-2">選択されたタイトル:</p>
            <p className="text-lg font-semibold text-indigo-600">{selectedTitle}</p>
            <p className="text-gray-500 mt-4">3000文字以上の高品質な記事を執筆しています。少々お待ちください。</p>
          </div>
        )}

        {step === 'result' && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">生成完了！</h2>
              <div className="flex gap-3">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'コピー完了' : 'コピー'}
                </button>
                <button
                  onClick={downloadArticle}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Download className="w-4 h-4 mr-2" />
                  ダウンロード
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                >
                  新規作成
                </button>
              </div>
            </div>
            
            <div className="mb-4 flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <span className="font-semibold text-gray-700">出力形式:</span>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="text"
                  checked={outputFormat === 'text'}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="mr-2 w-4 h-4"
                />
                <span className="text-gray-700">テキスト (Markdown)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="html"
                  checked={outputFormat === 'html'}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="mr-2 w-4 h-4"
                />
                <span className="text-gray-700">HTML</span>
              </label>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 max-h-[600px] overflow-y-auto border-2 border-gray-200">
              <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed text-sm">
                {getOutputContent()}
              </pre>
            </div>
            <div className="mt-6 p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-600">
              <p className="text-sm text-gray-700">
                <strong>💡 ヒント:</strong> 生成された記事は、さらに独自の経験や具体例を追加することで、よりオリジナリティが高まります。
                {outputFormat === 'html' && ' HTML形式でコピーすれば、そのままブログに貼り付けられます。'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
