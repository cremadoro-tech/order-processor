# /write-product — 商品出品コンテンツを自動生成する

## 概要

提供されたURLを読み込み、競合調査を行い、**デザイン性の高い楽天HTML形式**で商品ページを生成するスキル。
楽天コンテンツがユーザーに承認されたら、残り6チャネル向けに展開する。

**デザイン品質の担保:** `/ec-product-design` のデザイン原則に従い、「AIっぽくない」プロレベルのHTML出力を行う。
PRODUCT-SPEC.mdが存在する場合はそのデザインルールに準拠する。

---

## インプット形式

```
/write-product
商品名: [商品名・型番]
カテゴリ: [印鑑 | 筆記具 | 文具]（デザインガイド適用に使用）
現在のページURL: [URL]（リニューアルの場合のみ）
競合URL:
  - [メーカーサイトや競合ECのURL 1]
  - [競合URL 2]
  - [競合URL 3]（任意）
変更点・特徴:
  - [特徴や訴求ポイント 1]
  - [特徴や訴求ポイント 2]
価格: [円]
JANコード: [JANコード]（任意。未指定時はカタログIDなしの理由=3で登録）
モード: [standard | prototype]（任意。prototype=3パターン比較生成）
```

**必須**: 商品名・カテゴリ・変更点/特徴・価格
**任意**: 現在のページURL（リニューアル時）・競合URL（2〜3件）・JANコード・モード

---

## 実行フロー

### フェーズ0: デザインSPEC確認（自動）

1. `output/articles/` に該当商品の `PRODUCT-SPEC.md` が存在するか確認
2. **存在する場合:** SPECのデザインルール（カラー・フォント・セクション構成）に従って生成
3. **存在しない場合:** `/ec-product-design` のカテゴリ別デザインガイドをデフォルト適用
4. 適用するデザイン方針をユーザーに簡潔に提示して確認

---

### フェーズ0.5: プロトタイプモード（mode=prototype の場合のみ）

`mode: prototype` が指定された場合、本番生成の前にデザイン比較を行う:

1. カテゴリ別デザインガイドに基づき **3パターンの楽天HTML** を生成
   - パターンA: スタンダード（SPEC準拠）
   - パターンB: ビジュアル重視（画像大きめ・余白広め）
   - パターンC: 情報重視（コンパクト・データ充実）
2. 保存先: `output/prototypes/{商品名}-pattern-[A|B|C].html`
3. ユーザーに3パターンを提示 → 採用パターンを選択
4. 採用パターンのデザイン方針でフェーズ1に進む

---

### フェーズ1: 楽天コンテンツ生成

1. **情報収集（並列実行）**
   `.claude/agents/product-content-team.md` のリサーチャーを起動する。
   - 現在のページURLがある場合: Playwright で取得し、既存コンテンツを抽出
   - 競合・メーカーURLを Playwright で取得し、商品スペック・特徴・差別化ポイントを抽出

2. **楽天コンテンツ生成（デザイン品質重視）**
   コピーライターを起動する。
   - リサーチ結果 + 入力情報をもとに楽天HTML形式で生成
   - 下記「楽天 出力フォーマット」に従う
   - **デザイン原則チェック:** `/ec-product-design` のNEVER/ALWAYSルールを適用
   - カテゴリ別のカラー・フォント・余白ガイドに準拠

3. **品質レビュー（デザイン品質含む）**
   品質レビュアーを起動する。
   - HTML構造・文字数・禁止表現・必須セクションをチェック
   - **デザイン品質チェック追加:**
     - セクション間余白は十分か（padding 24px以上）
     - カラーが3色以内に収まっているか
     - フォントサイズにメリハリがあるか
     - 「AIっぽいデザイン」の回避ルールに違反していないか
   - スコアが80点未満の場合は修正して再生成

4. **ユーザーに提示・承認を得る**
   - 保存先: `output/articles/YYYY-MM-DD-[商品名]-rakuten.html`
   - 修正依頼があれば対応してから次フェーズへ進む

5. **楽天SP版（スマートフォン版）を生成**
   - PC版の承認後、SP版HTMLを一括生成（ポイント6: PC先行→SP一括）
   - 横幅100%、タップ可能な余白、フォントサイズ調整
   - 保存先: `output/articles/YYYY-MM-DD-[商品名]-rakuten-sp.html`

6. **楽天 商品登録CSVを生成する**
   - `.claude/agents/product-content-team.md` のCSV生成担当を起動する
   - ジャンルID自動取得 → カタログID設定 → Shift-JIS CSVとして出力
   - 保存先: `output/articles/YYYY-MM-DD-[商品名]-rakuten.csv`

---

### フェーズ2: 他チャネル展開（楽天承認後）

楽天コンテンツをベースに以下6チャネル向けのコンテンツを生成する：

| チャネル | タイトル文字数 | 説明文形式 | 特記事項 |
|:--------|:------------|:---------|:--------|
| Amazon | 150バイト以内 | 箇条書き5点（500文字以内/点） | キーワード前半配置 |
| Yahoo!ショッピング | 100文字以内 | テキスト2000文字以内 | 価格訴求を強調 |
| Shopify / 自社EC | 制限なし | HTML可 | ブランドストーリー重視 |
| ギフトモール | 制限なし | テキスト | ギフト文脈に特化 |
| AuPay | 100文字以内 | テキスト2000文字以内 | Yahoo!準拠で調整 |
| Qoo10 | 100文字以内 | テキスト | 分かりやすい表現 |

保存先: `output/articles/YYYY-MM-DD-[商品名]-[チャネル名].md`

---

## 楽天 出力フォーマット

楽天説明文は以下の構成で **デザイン性の高いHTML** で生成する。
カテゴリ別のデザインガイド（`/ec-product-design` 参照）に基づき、カラー・余白・フォントを適用する。

### HTML設計原則

- **テーブルレイアウトからの脱却:** `<div>` + インラインCSS で構成
- **セクション分離:** 各セクションは背景色の交互切り替え（白 / 薄グレー）で視覚分離
- **余白:** セクション間 padding: 28px〜40px、要素間 margin: 12px〜16px
- **カラー:** カテゴリ別デザインガイドの配色に従う（ベース + サブ + アクセントの3色構成）
- **フォント:** 見出しは font-size: 18px〜22px / font-weight: bold、本文は 14px〜15px / line-height: 1.7
- **楽天制約:** JavaScript不可、外部CSS不可 → 全てインラインスタイルで記述

### PC版 HTML構造

```html
<!-- 全体コンテナ -->
<div style="max-width:750px; margin:0 auto; font-family:'Hiragino Kaku Gothic ProN','メイリオ',sans-serif; color:#333; line-height:1.7;">

  <!-- ■ ヘッダー: 商品名 + キャッチコピー -->
  <div style="padding:32px 20px; background:{ベースカラー}; text-align:center;">
    <div style="font-size:13px; color:{アクセントカラー}; letter-spacing:2px; margin-bottom:8px;">[ブランド名]</div>
    <h1 style="font-size:22px; font-weight:bold; color:#fff; margin:0 0 12px 0; line-height:1.4;">[商品名]</h1>
    <p style="font-size:14px; color:rgba(255,255,255,0.85); margin:0;">[一行キャッチコピー]</p>
  </div>

  <!-- ■ 商品概要 -->
  <div style="padding:28px 20px; background:#fff;">
    <p style="font-size:15px; line-height:1.8; margin:0;">[150〜250字。使用シーン＋ギフト訴求を含める]</p>
  </div>

  <!-- ■ 主な特長（3〜5項目） -->
  <div style="padding:28px 20px; background:{サブカラー};">
    <h2 style="font-size:18px; font-weight:bold; color:{ベースカラー}; margin:0 0 20px 0; text-align:center;">主な特長</h2>
    <!-- 各特長をカード風に -->
    <div style="background:#fff; padding:20px; margin-bottom:12px; border-left:4px solid {アクセントカラー};">
      <div style="font-size:16px; font-weight:bold; margin-bottom:8px;">[特長タイトル]</div>
      <p style="font-size:14px; margin:0; line-height:1.7;">[150〜300字の説明]</p>
    </div>
    <!-- 繰り返し -->
  </div>

  <!-- ■ カテゴリ別スペック -->
  <div style="padding:28px 20px; background:#fff;">
    <h2 style="font-size:18px; font-weight:bold; color:{ベースカラー}; margin:0 0 20px 0;">商品仕様</h2>
    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <!-- 筆記具: インク・替芯 / 機能 / ボール径 / 機構 / サイズ / 重量 / 軸仕上 -->
      <!-- 印鑑: 素材 / サイズ / 書体 / 用途 / 付属品 -->
      <!-- 文具: 素材 / サイズ / 枚数・容量 / カラー展開 -->
      <tr>
        <th style="padding:10px 12px; background:{サブカラー}; text-align:left; width:30%; border-bottom:1px solid #ddd;">[項目名]</th>
        <td style="padding:10px 12px; border-bottom:1px solid #ddd;">[値]</td>
      </tr>
    </table>
  </div>

  <!-- ■ こんな方におすすめ -->
  <div style="padding:28px 20px; background:{サブカラー};">
    <h2 style="font-size:18px; font-weight:bold; color:{ベースカラー}; margin:0 0 16px 0;">こんな方におすすめ</h2>
    <ul style="margin:0; padding:0 0 0 20px; font-size:14px;">
      <li style="margin-bottom:8px;">[職種・シーン・年代等 — 6〜8項目]</li>
    </ul>
  </div>

  <!-- ■ ギフト・記念品として -->
  <div style="padding:28px 20px; background:#fff;">
    <h2 style="font-size:18px; font-weight:bold; color:{ベースカラー}; margin:0 0 16px 0;">ギフト・記念品として</h2>
    <p style="font-size:14px; line-height:1.7; margin:0;">[用途別シーン。名入れ対応の有無]</p>
  </div>

  <!-- ■ お手入れ方法 -->
  <div style="padding:28px 20px; background:{サブカラー};">
    <h2 style="font-size:18px; font-weight:bold; color:{ベースカラー}; margin:0 0 16px 0;">お手入れ方法</h2>
    <ul style="margin:0; padding:0 0 0 20px; font-size:14px;">
      <li style="margin-bottom:6px;">[3〜4項目]</li>
    </ul>
  </div>

  <!-- ■ ご注意 -->
  <div style="padding:20px; background:#fff; border-top:2px solid #eee;">
    <h2 style="font-size:16px; font-weight:bold; color:#666; margin:0 0 12px 0;">ご注意</h2>
    <ul style="margin:0; padding:0 0 0 20px; font-size:13px; color:#ba2b2b;">
      <li style="margin-bottom:4px;">[注意事項3〜5項目]</li>
    </ul>
  </div>

</div>

<!-- 末尾SEOキーワード文（平文・改行なし） -->
<div style="font-size:1px; color:#999; line-height:1.2; margin-top:8px;">
[ギフトシーン・用途・受取人・イベント名等のキーワードを羅列]
</div>
```

### SP版（スマートフォン版）調整ポイント

PC版HTMLをベースに以下を一括変更:
- `max-width:750px` → `width:100%; max-width:100%`
- フォントサイズ: 見出し 16px〜18px、本文 14px
- padding: 20px〜28px に縮小
- テーブル: 横スクロール回避のため `display:block` 化
- タップ領域: リンク・ボタンは最低44px確保

---

## 出力ファイル構成

```
output/prototypes/                       ← プロトタイプモード時のみ
  {商品名}-pattern-A.html
  {商品名}-pattern-B.html
  {商品名}-pattern-C.html

output/articles/
  YYYY-MM-DD-[商品名]-PRODUCT-SPEC.md   ← デザインSPEC（/ec-product-design で生成時）
  YYYY-MM-DD-[商品名]-rakuten.html      ← フェーズ1: 楽天商品説明文 PC版（HTML）
  YYYY-MM-DD-[商品名]-rakuten-sp.html   ← フェーズ1: 楽天商品説明文 SP版（HTML）
  YYYY-MM-DD-[商品名]-rakuten.csv       ← フェーズ1: 楽天商品登録CSV（Shift-JIS）
  YYYY-MM-DD-[商品名]-amazon.md         ← フェーズ2
  YYYY-MM-DD-[商品名]-yahoo.md
  YYYY-MM-DD-[商品名]-shopify.md
  YYYY-MM-DD-[商品名]-giftmall.md
  YYYY-MM-DD-[商品名]-aupay.md
  YYYY-MM-DD-[商品名]-qoo10.md
```
