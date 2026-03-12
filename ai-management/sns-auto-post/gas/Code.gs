/**
 * SNS自動投稿システム - Google Apps Script
 * Phase 1: シート初期化 + Claude API（system/userプロンプト分離）で投稿文生成
 */

// ===== 設定 =====
const CONFIG = {
  CLAUDE_API_KEY: PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY'),
  CLAUDE_MODEL: 'claude-sonnet-4-5-20250929',
  CLAUDE_API_URL: 'https://api.anthropic.com/v1/messages',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.8,
};

// ===== シート名定数 =====
const SHEETS = {
  PRODUCTS: '商品マスタ',
  SCHEDULE: '投稿スケジュール',
  TEMPLATES: 'テンプレート',
};

// ===== 禁止ワード =====
const BANNED_WORDS = ['業界No.1', '日本一', 'いかがでしたか', 'ぜひチェックしてみてください', '最高品質', 'こだわりの', 'プロが認めた'];
const MARKDOWN_PATTERNS = ['**', '##', '---', '```', '> '];

// ===== systemプロンプト =====
const SYSTEM_PROMPT = `あなたは、日本のEC企業「ハンコヤストア」専属のSNSコピーライターです。
印鑑・スタンプ・名前シール・ペンなどの「名前にまつわる商品」を販売しています。

あなたの仕事は、スプレッドシートから渡される商品情報をもとに、指定されたSNSプラットフォーム向けの投稿文を1つだけ生成することです。

【絶対ルール（違反時は出力やり直し）】
1. 投稿文のみを出力せよ。前置き・補足・説明・選択肢の提示は一切禁止。
2. マークダウン記法（**、##、---、-、>、` + '```' + `等）は絶対に使用禁止。完全なプレーンテキストのみ。
3. 「いかがでしたか」「ぜひチェックしてみてください」等の定型フレーズ禁止。
4. 「最高品質」「こだわりの」「プロが認めた」等の根拠なき誇張表現禁止。
5. 嘘・誇大広告・景品表示法に抵触する表現禁止。「業界No.1」「日本一」等は使用不可。
6. 出力は必ず1パターンのみ。複数案の提示禁止。

【トーンの基準】
- 友人に「これ良かったよ」と教える温度感。売り込み感ゼロ。
- 体験談ベース：「使ってみたら〇〇だった」「正直、最初は△△だと思ってた」。
- 読み手の頭の中にある「あるある」を言語化して共感を起こす。
- 漢字3割・ひらがな7割を目安に、読みやすさ最優先。
- 「！」は投稿全体で最大2回まで。多用すると安っぽくなる。

【絵文字ルール】
- 1文につき最大1個。連続使用禁止（🎉🎉🎉 のような表現はNG）。
- 文頭の絵文字は禁止（📌まず〜 のような書き出しはNG）。
- 使う場合は文末に自然に添える程度。なくても良い。

【ハッシュタグルール】
- 本文中には混ぜない。必ず最終行にまとめて配置。
- プラットフォームごとの個数は後述のルールに従う。

【商品紹介の鉄則】
- スペック（素材・サイズ等）は「だから何が嬉しいのか」に必ず変換せよ。
  例：✕「チタン製で耐久性抜群」→ ○「一生買い替えなくていい安心感」
- 「誰の・どんな場面の・どんな悩みを解決するか」を必ず含める。
- 価格に触れる場合は「意外と手が届く」「ランチ1回分」等、比較で伝える。`;

// ===== メニュー =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SNS投稿')
    .addItem('シートを初期化', 'initializeSheets')
    .addSeparator()
    .addItem('選択行の投稿文を生成', 'generatePostForSelectedRow')
    .addItem('未生成の投稿文を一括生成', 'generateAllPendingPosts')
    .addToUi();
}

// ===== シート初期化 =====
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // シート1: 商品マスタ
  const productHeaders = [
    '商品ID', '商品名', 'カテゴリ', 'ターゲット', 'ターゲットの悩み',
    'ベネフィット', '商品URL', '写真URL', '価格', '補足情報'
  ];
  setupSheet(ss, SHEETS.PRODUCTS, productHeaders, [
    { col: 1, width: 100 },
    { col: 2, width: 200 },
    { col: 3, width: 120 },
    { col: 4, width: 200 },
    { col: 5, width: 250 },
    { col: 6, width: 250 },
    { col: 7, width: 300 },
    { col: 8, width: 300 },
    { col: 9, width: 80 },
    { col: 10, width: 250 },
  ]);

  // シート2: 投稿スケジュール
  const scheduleHeaders = [
    '投稿日', 'SNS', '商品ID', '形式', '生成テキスト',
    'ステータス', '生成日時', '投稿URL', '備考'
  ];
  setupSheet(ss, SHEETS.SCHEDULE, scheduleHeaders, [
    { col: 1, width: 120 },
    { col: 2, width: 120 },
    { col: 3, width: 100 },
    { col: 4, width: 100 },
    { col: 5, width: 500 },
    { col: 6, width: 100 },
    { col: 7, width: 160 },
    { col: 8, width: 300 },
    { col: 9, width: 200 },
  ]);
  const scheduleSheet = ss.getSheetByName(SHEETS.SCHEDULE);
  // ステータス
  scheduleSheet.getRange('F2:F').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['未生成', '生成済', '承認済', '投稿済', '要修正', 'スキップ'])
      .build()
  );
  // SNS
  scheduleSheet.getRange('B2:B').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Instagram', 'X', 'Threads', 'Facebook', 'TikTok', 'YouTube Shorts'])
      .build()
  );
  // 形式
  scheduleSheet.getRange('D2:D').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['画像投稿', 'リール/ショート', 'カルーセル', 'ストーリー', 'テキスト'])
      .build()
  );

  // シート3: テンプレート（初期データ入り）
  const templateHeaders = [
    'SNS名', 'トーン', '文字数目安', 'ハッシュタグ個数', 'CTA例'
  ];
  const templateSheet = setupSheet(ss, SHEETS.TEMPLATES, templateHeaders, [
    { col: 1, width: 150 },
    { col: 2, width: 200 },
    { col: 3, width: 120 },
    { col: 4, width: 150 },
    { col: 5, width: 300 },
  ]);
  const templateData = [
    ['Instagram', 'カジュアル・体験談ベース', '300〜500文字', '10〜15個（大3+中5+小5）', 'プロフィールのリンクから'],
    ['X', '短文・インパクト重視', '140文字以内', '3個以内', 'URL直貼り'],
    ['Threads', 'ひとりごと・内省的', '100〜200文字', '1個（1投稿1トピック制限）', '売り込み感排除'],
    ['Facebook', 'やや丁寧・情報的', '300〜500文字', '3〜5個', '詳しくはこちら→（URL）'],
    ['TikTok', 'テンポ良く・若者向け', '100〜300文字', '3〜5個', 'コメントで教えて'],
    ['YouTube Shorts', '説明的・丁寧', '50〜100文字', '3〜5個', 'チャンネル登録お願いします'],
  ];
  templateSheet.getRange(2, 1, templateData.length, templateData[0].length).setValues(templateData);

  // デフォルトシート削除
  const defaultSheet = ss.getSheetByName('シート1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  SpreadsheetApp.getUi().alert('シートの初期化が完了しました！');
}

function setupSheet(ss, sheetName, headers, columnSettings) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285F4');
  headerRange.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  for (const col of columnSettings) {
    sheet.setColumnWidth(col.col, col.width);
  }

  return sheet;
}

// ===== 投稿文生成 =====

function generatePostForSelectedRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scheduleSheet = ss.getSheetByName(SHEETS.SCHEDULE);
  const activeRange = scheduleSheet.getActiveRange();

  if (!activeRange) {
    SpreadsheetApp.getUi().alert('投稿スケジュールシートで行を選択してください。');
    return;
  }

  const row = activeRange.getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert('ヘッダー行は選択できません。');
    return;
  }

  const result = generatePostForRow(scheduleSheet, row);
  SpreadsheetApp.getUi().alert(result);
}

function generateAllPendingPosts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scheduleSheet = ss.getSheetByName(SHEETS.SCHEDULE);
  const lastRow = scheduleSheet.getLastRow();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('投稿スケジュールにデータがありません。');
    return;
  }

  let generated = 0;
  let errors = 0;
  for (let row = 2; row <= lastRow; row++) {
    const status = scheduleSheet.getRange(row, 6).getValue();
    if (status === '未生成' || status === '') {
      const result = generatePostForRow(scheduleSheet, row);
      if (result.includes('生成しました')) {
        generated++;
      } else {
        errors++;
      }
      Utilities.sleep(1500);
    }
  }

  SpreadsheetApp.getUi().alert(`完了: ${generated}件生成, ${errors}件エラー`);
}

function generatePostForRow(scheduleSheet, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const productSheet = ss.getSheetByName(SHEETS.PRODUCTS);

  // スケジュールデータ取得
  const rowData = scheduleSheet.getRange(row, 1, 1, 9).getValues()[0];
  const [postDate, platform, productId, format] = rowData;

  if (!platform || !productId) {
    scheduleSheet.getRange(row, 6).setValue('スキップ');
    return `${row}行目: SNSまたは商品IDが未入力のためスキップ`;
  }

  // 商品データ取得
  const product = findProduct(productSheet, productId);
  if (!product) {
    scheduleSheet.getRange(row, 9).setValue('商品IDが見つかりません');
    scheduleSheet.getRange(row, 6).setValue('スキップ');
    return `${row}行目: 商品ID「${productId}」が見つかりません`;
  }

  // userプロンプト構築
  const userPrompt = buildUserPrompt(product, platform, format);

  // Claude API呼び出し（最大2回リトライ）
  let generatedText = '';
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    generatedText = callClaudeAPI(userPrompt);
    attempts++;

    if (generatedText.startsWith('[ERROR]')) {
      break; // APIエラーはリトライしない
    }

    // 後処理チェック
    const issue = validateOutput(generatedText, platform);
    if (!issue) {
      break; // 問題なし
    }

    if (attempts < maxAttempts) {
      Utilities.sleep(1000);
    } else {
      // リトライ後も問題あり → 要修正として保存
      scheduleSheet.getRange(row, 5).setValue(generatedText);
      scheduleSheet.getRange(row, 6).setValue('要修正');
      scheduleSheet.getRange(row, 7).setValue(new Date());
      scheduleSheet.getRange(row, 9).setValue(issue);
      return `${row}行目: 生成済（要修正: ${issue}）`;
    }
  }

  // 結果を書き込み
  scheduleSheet.getRange(row, 5).setValue(generatedText);
  scheduleSheet.getRange(row, 6).setValue(generatedText.startsWith('[ERROR]') ? 'スキップ' : '生成済');
  scheduleSheet.getRange(row, 7).setValue(new Date());

  return `${row}行目: 生成しました`;
}

// ===== 後処理バリデーション =====

function validateOutput(text, platform) {
  // マークダウン混入チェック
  for (const pattern of MARKDOWN_PATTERNS) {
    if (text.includes(pattern)) {
      return `マークダウン「${pattern}」が含まれています`;
    }
  }

  // 禁止ワードチェック
  for (const word of BANNED_WORDS) {
    if (text.includes(word)) {
      return `禁止ワード「${word}」が含まれています`;
    }
  }

  // X（旧Twitter）文字数チェック
  if (platform === 'X' && text.length > 140) {
    return `X投稿が${text.length}文字です（上限140文字）`;
  }

  return null; // 問題なし
}

// ===== 商品検索 =====

function findProduct(productSheet, productId) {
  const data = productSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(productId)) {
      return {
        name: data[i][1],
        category: data[i][2],
        target: data[i][3],
        painPoint: data[i][4],
        benefit: data[i][5],
        url: data[i][6],
        photoUrl: data[i][7],
        price: data[i][8],
        notes: data[i][9],
      };
    }
  }
  return null;
}

// ===== userプロンプト構築 =====

function buildUserPrompt(product, platform, format) {
  return `以下の情報をもとに、${platform} 向けの投稿文を1つ作成してください。

【商品情報】
商品名: ${product.name}
商品カテゴリ: ${product.category}
ターゲット: ${product.target || '指定なし'}
ターゲットの悩み: ${product.painPoint || '指定なし'}
伝えたいベネフィット: ${product.benefit || '指定なし'}
商品URL: ${product.url}
補足情報: ${product.notes || 'なし'}

【プラットフォーム別ルール】
このルールに厳密に従ってください。

■ X（旧Twitter）の場合：
- 合計140文字以内（ハッシュタグ含む）。1文字でも超過したら書き直し。
- 構成：フック（1行）→ 空行 → 本文（1〜2行）→ 空行 → URL → ハッシュタグ（3個以内）
- 1行目が命。スクロールを止める「え？」と思わせる一言から始める。
- 1行目のパターン例（毎回変えること）：
  ・逆説型：「印鑑なんて何でもいいと思ってた」
  ・問いかけ型：「届いた瞬間、箱を開ける手が震えたことある？」
  ・数字型：「3秒で届く"ちゃんとした大人"感」
  ・告白型：「正直に言います。100均の印鑑、恥ずかしかった」
- 体言止め・倒置法を活用してテンポを出す。

■ Instagramの場合：
- 文字数：300〜500文字程度（長すぎず、短すぎず）。
- 構成：フック（1行）→ 空行 → 共感ストーリー（3〜5行）→ 空行 → ベネフィット紹介（2〜3行）→ 空行 → 行動喚起（1行）→ 空行 → ハッシュタグ（10〜15個）
- 「写真で伝わらない部分」を文章で補完する意識。
- ストーリーは「過去の自分（悩み）→ 出会い → 変化後の今」の3幕構成。
- ハッシュタグ戦略：
  ・ビッグワード3個（例：#印鑑 #入学準備 #新生活）
  ・ミドルワード5個（例：#はんこ女子 #実印デビュー #大人の持ち物）
  ・スモールワード5個（例：#ハンコヤストア #天然石印鑑 #印鑑ケース可愛い）

■ Threadsの場合：
- 文字数：100〜200文字程度。
- 構成：本音の独白（2〜3行）→ 空行 → 気づき or オチ（1行）
- トーン：ひとりごと。「〜なんだよね」「〜って気づいた」のような内省的な語尾。
- ハッシュタグは1個のみ（Threadsは1投稿1トピック制限）。最も重要なキーワードを選ぶこと。
- 売り込み感は最も排除すべきプラットフォーム。
  「商品紹介」ではなく「自分の気づき」の中に商品が自然に登場する構成にすること。

■ Facebookの場合：
- 文字数：300〜500文字程度。
- 構成：フック → ストーリー → ベネフィット → CTA → ハッシュタグ（3〜5個）
- ややフォーマルだが堅すぎない。情報量多めでOK。

■ TikTokの場合：
- 文字数：100〜300文字程度。
- テンポ重視。短い文の連続。
- ハッシュタグは3〜5個。トレンドタグ重視。

■ YouTube Shortsの場合：
- 文字数：50〜100文字程度。
- 動画の補足説明として機能する簡潔な文。
- ハッシュタグは3〜5個。`;
}

// ===== Claude API =====

function callClaudeAPI(userPrompt) {
  if (!CONFIG.CLAUDE_API_KEY) {
    return '[ERROR] CLAUDE_API_KEYが設定されていません。スクリプトプロパティに設定してください。';
  }

  const payload = {
    model: CONFIG.CLAUDE_MODEL,
    max_tokens: CONFIG.MAX_TOKENS,
    temperature: CONFIG.TEMPERATURE,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': CONFIG.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.CLAUDE_API_URL, options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      return `[ERROR] ${json.error.message}`;
    }

    return json.content[0].text;
  } catch (e) {
    return `[ERROR] API呼び出しに失敗しました: ${e.message}`;
  }
}
