"""Amazon専用 属性抽出モジュール

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

    # パターン5: 【楷書体】等の書体名が直接ある
    font_names = ["楷書体", "明朝体", "古印体", "行書体", "隷書体", "てん書体",
                  "印相体", "丸ゴシック体", "丸ゴシック", "ゴシック体"]
    for font in font_names:
        if font in text:
            return font

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
        # 全角スペースを除去して連結（「木　部　忠　仁」→「木部忠仁」）
        name = re.sub(r"[\s　]+", "", name)
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
