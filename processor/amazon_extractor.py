"""Amazon専用 属性抽出モジュール + 複数名行展開

Amazonの備考欄（「23:59:59」以降のフリーテキスト）から、
書体・カラー・作成名・サイズ・配置等を抽出する。

楽天の「項目・選択肢」（ボディカラー=ピンク の改行区切り）とは
フォーマットが全く異なるため、専用の抽出ロジックが必要。

備考欄パターン例:
  ジョインティ: "【彫刻名：鍵谷】 【書体：楷書体】 鍵谷 莉乃"
  オスカ:       "名入れ書体：【てん書体】 名入れ文字：【横井】 百瀬 瑛"
  のべ台:       "名入れ書体：【明朝体】 文字：【木部忠仁】 木部忠仁"
  タニガワ:     "書体：【楷書体】 名入れ文字：【天野】 藤岡 潤"
"""

import re


def extract_amazon_attributes(options_text, product_name=""):
    """Amazon備考欄から書体・カラー・作成名等を抽出する。

    Args:
        options_text: normalizer.pyで抽出された「項目・選択肢」（=備考の23:59:59以降）
        product_name: 商品名（サイズ・カラー判定に使用）
    Returns:
        dict: {"書体": "楷書体", "作成名": "田中", "カラー": "ブラック", ...}
    """
    result = {
        "書体": "",
        "作成名": "",
        "カラー": "",
        "サイズ": "",
        "配置": "",
    }

    if not options_text:
        return result

    text = options_text.strip()

    # === 書体抽出 ===
    result["書体"] = _extract_font(text)

    # === 作成名抽出 ===
    result["作成名"] = _extract_creation_name(text)

    # === カラー抽出（商品名の括弧内） ===
    result["カラー"] = _extract_color(product_name)

    # === サイズ抽出（商品名から） ===
    result["サイズ"] = _extract_size(product_name)

    # === 配置抽出 ===
    result["配置"] = _extract_direction(text, product_name)

    return result


def _extract_font(text):
    """書体を抽出する。

    パターン:
    - 【書体：楷書体】
    - 名入れ書体：【明朝体】
    - 書体：【楷書体】
    - 書体　　楷書体
    - 字体:丸ゴシック
    """
    # 特殊パターン: 【書体：名前】 【刻印：書体名】 の逆転パターン
    match_reverse = re.search(r"【書体[：:]([^】]+)】.*【刻印[：:]([^】]+)】", text)
    if match_reverse:
        return match_reverse.group(2).strip()  # 刻印の値が本当の書体

    # パターン0: 「名入れ書体：/004.有澤楷書体」のし用番号付き書体
    match = re.search(r"名入れ書体[：:/]+\s*(\d+\.[^\s　\n【]+)", text)
    if match:
        return match.group(1).strip().rstrip("※")

    # パターン1: 【書体：○○】 or 書体：【○○】
    match = re.search(r"(?:名入れ)?書体[：:]\s*【([^】]+)】", text)
    if match:
        return match.group(1).strip()

    # パターン2: 【書体：○○】
    match = re.search(r"【書体[：:]([^】]+)】", text)
    if match:
        return match.group(1).strip()

    # パターン3: 書体　　○○（全角スペース区切り）
    match = re.search(r"書体[\s　]+([^\s　【」\n]+(?:体|書))", text)
    if match:
        return match.group(1).strip()

    # パターン4: 字体:○○
    match = re.search(r"字体[：:]\s*([^\s　\n]+)", text)
    if match:
        return match.group(1).strip()

    # パターン5: 【刻印：古印体】
    match = re.search(r"【刻印[：:]([^】]+)】", text)
    if match:
        return match.group(1).strip()

    # パターン6: 書体:○○（コロン区切り、括弧なし）
    match = re.search(r"書体[：:]\s*([^\s　\n【】]+)", text)
    if match:
        val = match.group(1).strip().rstrip("※")
        # 書体名リストと照合
        font_names_map = {"楷書": "楷書体", "明朝": "明朝体", "古印": "古印体",
                          "行書": "行書体", "隷書": "隷書体", "てん書": "てん書体",
                          "印相": "印相体", "丸ゴシック": "丸ゴシック体", "ゴシック": "ゴシック体",
                          "クラフト": "クラフト体"}
        for short, full in font_names_map.items():
            if short in val:
                return full
        return val

    # パターン7: 書体名が直接テキスト内にある（フリーテキスト対応）
    font_names = ["楷書体", "明朝体", "古印体", "行書体", "隷書体", "てん書体",
                  "印相体", "丸ゴシック体", "丸ゴシック", "ゴシック体", "クラフト体"]
    for font in font_names:
        if font in text:
            return font

    # パターン8: 「楷書」「明朝」など短縮形
    short_fonts = {"楷書": "楷書体", "明朝": "明朝体", "古印": "古印体"}
    for short, full in short_fonts.items():
        if short in text:
            return full

    return ""


def _extract_creation_name(text):
    """作成名（彫刻名・名入れ文字）を抽出する。

    パターン:
    - 【彫刻名：鍵谷】
    - 名入れ文字：【横井】
    - 彫刻名　　宮本
    - 名前:辻本しんにょう1点
    """
    # パターン1: 【彫刻名：○○】 or 名入れ文字：【○○】
    match = re.search(r"(?:彫刻名|名入れ文字|作成名|名前)[：:]\s*【([^】]+)】", text)
    if match:
        name = match.group(1).strip()
        # 余分なスペースを正規化
        name = re.sub(r"[\s　]+", "", name) if len(name) <= 5 else re.sub(r"[\s　]+", " ", name).strip()
        return name

    # パターン2: 【彫刻名：○○】
    match = re.search(r"【(?:彫刻名|名入れ文字)[：:]([^】]+)】", text)
    if match:
        name = match.group(1).strip()
        name = re.sub(r"[\s　]+", "", name) if len(name) <= 5 else re.sub(r"[\s　]+", " ", name).strip()
        return name

    # パターン3: 彫刻名　　○○（全角スペース区切り）
    match = re.search(r"(?:彫刻名|名入れ文字|名前)[：:\s　]+([^\s　【\n]+(?:[\s　][^\s　【\n]+)?)", text)
    if match:
        name = match.group(1).strip()
        # 「書体」等の次の項目名が混入していないか
        name = re.split(r"(?:書体|字体|文字)", name)[0].strip()
        if name:
            return name

    # パターン4: 文字：【○○】
    match = re.search(r"文字[：:]\s*【([^】]+)】", text)
    if match:
        name = match.group(1).strip()
        name = re.sub(r"[\s　]+", "", name)
        return name

    # パターン5: 【彫刻名】○○ or 【作成名：○○】（コロンなし or 内部コロン）
    match = re.search(r"【(?:彫刻名|名前|作成名)[：:]?([^】]+)】", text)
    if match:
        name = match.group(1).strip()
        name = re.split(r"(?:書体|字体|山が|です|カラー)", name)[0].strip()
        # コロンの後に名前がある場合
        if "：" in name or ":" in name:
            name = re.split(r"[：:]", name, 1)[-1].strip()
        if name:
            return name

    # パターン6: 【書体：○○】 【刻印：△△】の場合、書体が名前、刻印が書体
    match = re.search(r"【書体[：:]([^】]+)】.*【刻印[：:]([^】]+)】", text)
    if match:
        # この場合「書体」の値が実は名前
        return match.group(1).strip()

    # パターン7: フリーテキスト（名前 書体 注文者名）or（カラー 書体 名前 注文者名）
    # 書体名（短縮形含む）を見つけて、その前後から作成名を探す
    font_patterns = ["楷書体", "明朝体", "古印体", "行書体", "隷書体", "てん書体",
                     "印相体", "丸ゴシック体", "丸ゴシック", "ゴシック体", "クラフト体",
                     "楷書", "明朝", "古印"]
    # カラー名リスト（フリーテキストから除去用）
    color_names = {"アイボリー", "プレミアムブルー", "プレミアムレッド", "パステルブルー",
                   "パステルイエロー", "コーラルピンク", "ミントグリーン", "ラベンダー",
                   "ローズピンク", "グレージュ", "ハニーオレンジ", "レモンイエロー",
                   "ピュアホワイト", "スカイブルー", "スモーキーピンク", "ライムグリーン",
                   "ピアノブラック", "アッシュピンク", "アッシュグレー",
                   "ブラック", "ホワイト", "ディープブルー", "ライトブルー",
                   "ディープピンク", "ライトピンク", "イエロー"}
    for font in font_patterns:
        if font in text:
            idx = text.find(font)
            before = text[:idx].strip()
            if before:
                parts = [p for p in re.split(r"[\s　]+", before) if p not in color_names]
                if parts:
                    name = parts[-1].strip()
                    if name and 1 <= len(name) <= 10 and re.search(r"[\u3040-\u309F\u4E00-\u9FFF]", name):
                        return name
            after = text[idx + len(font):].strip()
            if after:
                parts = re.split(r"[\s　]+", after)
                name = parts[0].strip()
                if name and 1 <= len(name) <= 10 and re.search(r"[\u3040-\u309F\u4E00-\u9FFF]", name):
                    return name
            break

    # パターン8: 純粋フリーテキスト（名前 注文者名）書体キーワードなし
    # 最初のスペース区切りの単語を作成名とする
    # 例: "落合 落合" → "落合", "山下 小澤三津生" → "山下"
    first_line = text.split("\n")[0].strip()
    if first_line:
        parts = re.split(r"[\s　]+", first_line)
        if len(parts) >= 1:
            name = parts[0].strip()
            # 日本語の名前っぽいか（1〜5文字の漢字/ひらがな）
            if name and 1 <= len(name) <= 8 and re.search(r"[\u3040-\u309F\u4E00-\u9FFF]", name):
                return name

    return ""


def _extract_color(product_name):
    """商品名の末尾括弧からカラーを抽出。

    例: "ジョインティＪ9 10mm丸 回転式ネーム印 (プレミアムブルー)(QE-2F5A-02CY)"
    → "プレミアムブルー"
    """
    if not product_name:
        return ""

    # 括弧内を全て抽出（SKU以外）
    matches = re.findall(r"\(([^)]+)\)", product_name)
    for m in matches:
        # SKUっぽいもの（英数字+ハイフンのみ）はスキップ
        if re.match(r"^[A-Za-z0-9\-]+$", m):
            continue
        # 数値のみもスキップ
        if re.match(r"^\d+$", m):
            continue
        # カラー名っぽいもの
        return m.strip()
    return ""


def _extract_size(product_name):
    """商品名からサイズを抽出。

    例: "ジョインティＪ9 10mm丸" → "10mm"
         "ゴム印 科目印 氏名印 6mm×30mm" → "6mm×30mm"
         "オスカ 10mm 丸" → "10mm"
    """
    if not product_name:
        return ""

    # パターン1: Nmm×Nmm
    match = re.search(r"(\d+mm[×x]\d+mm)", product_name)
    if match:
        return match.group(1)

    # パターン2: Nmm丸 or Nmm
    match = re.search(r"(\d+(?:\.\d+)?)\s*mm", product_name)
    if match:
        return f"{match.group(1)}mm"

    return ""


def _extract_direction(text, product_name):
    """配置（文字の向き）を抽出。

    例: "文字の配置：【ヨコ書き】" → "ヨコ"
    """
    # 分割印の配置
    match = re.search(r"(?:配置|文字の配置)[：:]\s*【?([^】\n]+)】?", text)
    if match:
        d = match.group(1).strip()
        if "ヨコ" in d or "横" in d:
            return "ヨコ"
        if "タテ" in d or "縦" in d:
            return "タテ"
        return d

    # 商品名から判定
    if "ヨコ書き" in product_name or "横書き" in product_name:
        return "ヨコ"
    if "タテ書き" in product_name or "縦書き" in product_name:
        return "タテ"

    # テキスト内に「タテ」「たて」「縦」があればタテ
    if text and re.search(r"(?:タテ|たて|縦)", text):
        return "タテ"

    # のべ台（科目印・氏名印）はデフォルト「ヨコ」
    if "科目印" in product_name or "氏名印" in product_name:
        return "ヨコ"

    return ""


def _shorten_product_name(product_name, category):
    """商品名を短縮する（作業指示書用）。

    例: "ハンコヤストア 印鑑・はんこ/ネーム印 ジョインティＪ9 10mm丸 回転式ネーム印 認印 (ラベンダー)"
    → "ジョインティ 10mm"
    """
    name = product_name

    # 「ハンコヤストア」「ハンコヤトア」を除去
    name = re.sub(r"ハンコヤ[スト]+ア\s*", "", name)

    # 括弧内を除去（SKU等）
    name = re.sub(r"\([^)]*\)", "", name)

    # カテゴリ別の短縮
    if category in ("ジョインティ", "jyoin-10"):
        match = re.search(r"ジョインティ.*?(\d+)\s*mm", name)
        if match:
            return f"ジョインティ {match.group(1)}mm"
        if "ジョインティ" in name or "Ｊ9" in name or "J9" in name:
            if "6mm" in name or "６mm" in name:
                return "ジョインティ 6mm"
            return "ジョインティ 10mm"

    if category in ("オスカ", "oscca-10"):
        if "6mm" in name or "6 mm" in name or "６mm" in name:
            return "オスカ6mm"
        return "オスカ10mm"

    if category in ("のべ台", "gomu-nob"):
        return "ゴム印 科目印 氏名印"

    if category in ("オリジナル分割印", "original-bunkatsuin"):
        # 枚数を抽出（商品名 or 元の名前から）
        match = re.search(r"(\d+)枚", product_name)
        if match:
            return f"分割印{match.group(1)}枚"
        return "分割印1枚"

    if category in ("タニガワ", "tani-n-gtc"):
        if "スヌーピー" in name:
            return "スヌーピーツインGT"
        if "ツインGT" in name or "ツイン" in name:
            return "ツインGTキャップレス"
        if "スタンペン4FCL" in name or "4FCL" in name:
            return "スタンペン4FCL"
        if "スタンペンG" in name:
            return "スタンペンG"
        return name[:20]

    if "おむつ" in name:
        return "おむつスタンプ "

    if "のし袋" in name:
        return "のし袋用スタンプ"

    # デフォルト: 30文字まで
    return name.strip()[:30]


def expand_multi_name_rows(row):
    """備考に複数の名入れがある場合、名前ごとに行を展開する。

    パターン1: 改行区切りで「名入れ文字：【○○】」が複数ある
      例: 【明朝体】 名入れ文字：【日本郵便】\n【明朝体】 名入れ文字：【松沢志乃】\n...
      → 各名前ごとに1行

    パターン2: スペース区切りで複数の名前が並んでいる（個数>1）
      例: 中田　旬　　藤原　想輔　　日戸　珈吹...（個数13）
      → 全角スペース2つ以上で分割して各名前ごとに1行

    Returns:
        list[dict]: 展開された行のリスト。展開不要なら1要素のリスト。
    """
    options = str(row.get("項目・選択肢", ""))
    product_name = str(row.get("商品名", ""))

    # パターン1: 「名入れ文字：【○○】」が複数ある、または1つでもスラッシュ区切りで複数名
    names = re.findall(r"名入れ文字[：:]\s*【([^】]+)】", options)
    has_slash = any("/" in n or "／" in n for n in names)
    if len(names) >= 2 or (len(names) == 1 and has_slash):
        # 書体も各行から取得
        fonts = re.findall(r"【([^】]*体)】", options)
        rows = []
        for i, name in enumerate(names):
            # スラッシュ区切りで複数名が入っている場合は分割
            if "/" in name or "／" in name:
                sub_names = re.split(r"[/／]", name)
                for sn in sub_names:
                    sn = sn.strip()
                    if sn:
                        new_row = row.copy()
                        new_row["_expanded_name"] = sn
                        new_row["_expanded_font"] = fonts[i] if i < len(fonts) else (fonts[0] if fonts else "")
                        new_row["個数"] = "1"
                        rows.append(new_row)
            else:
                new_row = row.copy()
                name_clean = re.sub(r"[\s　]+", "", name) if len(name) <= 5 else re.sub(r"[\s　]+", " ", name).strip()
                new_row["_expanded_name"] = name_clean
                new_row["_expanded_font"] = fonts[i] if i < len(fonts) else (fonts[0] if fonts else "")
                new_row["個数"] = "1"
                rows.append(new_row)
        return rows

    # パターン1b: 「①作成名：岸田 ②作成名：富永...」の丸数字付きパターン
    numbered_names = re.findall(r"[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]作成名[：:]([^\s　①②③④⑤⑥⑦⑧⑨⑩×]+)", options)
    if len(numbered_names) >= 2:
        rows = []
        for name in numbered_names:
            new_row = row.copy()
            new_row["_expanded_name"] = name.strip()
            new_row["_expanded_font"] = ""
            new_row["個数"] = "1"
            rows.append(new_row)
        return rows

    # パターン1c: 改行区切りの「作成名：○○ 書体：△△」が複数ある
    lines_with_name = re.findall(r"作成名[：:]\s*([^\s　\n×]+)(?:.*?書体[：:]\s*([^\s　\n]+))?", options)
    if len(lines_with_name) >= 2:
        rows = []
        for match in lines_with_name:
            name = match[0].strip()
            font = match[1].strip() if match[1] else ""
            new_row = row.copy()
            new_row["_expanded_name"] = name
            new_row["_expanded_font"] = font
            new_row["個数"] = "1"
            rows.append(new_row)
        return rows

    # パターン2: 個数>1 かつ スペース区切りで名前が並んでいる
    try:
        qty = int(float(str(row.get("個数", "1"))))
    except (ValueError, TypeError):
        qty = 1

    if qty >= 2 and options:
        # 全角スペース2つ以上で分割
        parts = re.split(r"[\s　]{2,}", options.split("\n")[0].strip())
        # 最後の要素が注文者名の場合を除外（名前っぽくない長い文字列）
        name_parts = [p.strip() for p in parts if p.strip() and len(p.strip()) <= 10]

        if len(name_parts) >= 2 and len(name_parts) >= qty * 0.8:
            rows = []
            for name in name_parts:
                if not name:
                    continue
                new_row = row.copy()
                new_row["_expanded_name"] = name
                new_row["_expanded_font"] = ""
                new_row["個数"] = "1"
                rows.append(new_row)
            return rows

    # パターン3は過剰展開リスクが高いため無効化
    # のべ台等の改行区切り名前は、パターン1c（作成名：形式）で対応済み
    # 「名前のみの改行区切り」は自動判定が困難なため、手動確認推奨とする

    # 展開不要
    return [row]
