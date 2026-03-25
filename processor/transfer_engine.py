"""外注マクロの設定シート駆動転送ルールエンジン

外注マクロテンプレートNEW.xlsmの「設定」シートの11パターン転送ロジックを再現する。
核心は「消費型ロジック」：転送方法10で消費された行は、転送方法20/21/22の対象外になる。
"""

import re
import unicodedata

import pandas as pd

from config.settings_io import load_json


# ルールキャッシュ
_rules_cache = None


def load_transfer_rules():
    """transfer_rules.jsonを読み込んでキャッシュ"""
    global _rules_cache
    if _rules_cache is None:
        data = load_json("transfer_rules.json")
        _rules_cache = data.get("sheets", {})
    return _rules_cache


def get_sheet_names():
    """転送ルールが定義されている商品カテゴリ名一覧を返す"""
    rules = load_transfer_rules()
    return list(rules.keys())


def has_transfer_rules(sheet_name):
    """指定カテゴリに転送ルールが存在するかチェック"""
    rules = load_transfer_rules()
    return sheet_name in rules


def apply_transfer_rules(order_row, sheet_name, row_number=1):
    """1受注行に対して設定シートのルール群を適用し、出力列→値のdictを返す。

    Args:
        order_row: 元データの1行（pd.Series）
        sheet_name: 商品カテゴリ名（例: "オスカ"）
        row_number: 行番号（連番用）
    Returns:
        {"番号": "1", "商品名": "オスカ10ｍｍ", "カラー": "ピンク", ...}
    """
    rules = load_transfer_rules()
    if sheet_name not in rules:
        return {}

    columns = rules[sheet_name].get("columns", [])

    # 項目・選択肢からConsumedLineTrackerを作成
    options_text = str(order_row.get("項目・選択肢", ""))
    tracker = ConsumedLineTracker(options_text)

    result = {}
    for rule in columns:
        header = rule.get("header", "")
        if not header:
            continue

        value = _dispatch_rule(rule, order_row, tracker, row_number)

        # 同じヘッダーに複数ルールがある場合（転送方法2の変換マッピング等）
        # 値が空でなければ上書き、空なら既存値を保持
        if value:
            result[header] = value
        elif header not in result:
            result[header] = ""

    return result


def get_headers_for_sheet(sheet_name):
    """指定カテゴリの出力ヘッダー一覧を返す（重複除去・順序保持）"""
    rules = load_transfer_rules()
    if sheet_name not in rules:
        return []

    seen = set()
    headers = []
    for rule in rules[sheet_name].get("columns", []):
        h = rule.get("header", "")
        if h and h not in seen:
            headers.append(h)
            seen.add(h)
    return headers


class ConsumedLineTracker:
    """項目・選択肢テキストの行消費を追跡するクラス。

    外注マクロの「WORK2」シートに相当。
    転送方法10で使われた行は消費済みとしてマークされ、
    転送方法20/21/22は残った行のみを対象にする。
    """

    def __init__(self, text):
        self.original_lines = [line for line in text.split("\n") if line.strip()]
        self.consumed = set()

    def get_all_lines(self):
        """全行を返す（転送方法1-4用）"""
        return list(self.original_lines)

    def get_remaining_lines(self):
        """未消費の行のみ返す（転送方法20/21/22用）"""
        return [line for i, line in enumerate(self.original_lines)
                if i not in self.consumed]

    def consume(self, line_indices):
        """指定行インデックスを消費済みにマーク"""
        self.consumed.update(line_indices)

    def consume_by_content(self, matched_lines):
        """内容でマッチした行を消費済みにマーク"""
        for i, line in enumerate(self.original_lines):
            if line in matched_lines:
                self.consumed.add(i)


def _dispatch_rule(rule, order_row, tracker, row_number):
    """ルール1件を解釈して適切なパターン関数にディスパッチ"""
    method = rule.get("method")
    transfer = rule.get("transfer")

    if method == 1:
        return _method1_sequential(row_number)
    elif method == 2:
        return _method2_fixed(rule.get("fixed_value", ""))
    elif method == 3:
        source_col = rule.get("source_col", "")
        # 正規化後のカラム名にフォールバック
        if source_col and source_col not in order_row.index:
            col_aliases = {
                "GoQ管理番号(三桁ハイフン区切り)": "GoQ管理番号",
                "GoQ管理番号(カスタム)": "GoQ管理番号",
            }
            source_col = col_aliases.get(source_col, source_col)
        source_text = str(order_row.get(source_col, "")) if source_col else ""
        keywords = rule.get("search_keywords", [])

        if transfer == 1:
            return _method3_transfer1(source_text, keywords)
        elif transfer == 2:
            return _method3_transfer2(source_text, keywords, rule.get("transform_value", ""))
        elif transfer == 3:
            return _method3_transfer3(source_text, keywords)
        elif transfer == 4:
            return _method3_transfer4(source_text, keywords, rule.get("split_index", 0))
        elif transfer == 10:
            return _method3_transfer10(tracker, source_text, source_col, keywords, rule.get("remove_parts", []))
        elif transfer == 11:
            return _method3_transfer10(tracker, source_text, source_col, keywords, rule.get("remove_parts", []))
        elif transfer == 12:
            return _method3_transfer12(source_text, keywords)
        elif transfer == 20:
            return _method3_transfer20(tracker, rule.get("remove_parts", []))
        elif transfer == 21:
            return _method3_transfer21(tracker, rule.get("char_type", 1))
        elif transfer == 22:
            return _method3_transfer22(tracker, rule.get("line_number", 1))
        else:
            # 未知の転送方法: ソース列をそのまま返す
            return source_text
    elif method == 4:
        return _method4_formula(rule.get("formula", ""))
    else:
        return ""


def _method1_sequential(row_number):
    """方法1: 連番"""
    return str(row_number)


def _method2_fixed(fixed_value):
    """方法2: 固定文字列をそのまま入力"""
    return fixed_value or ""


def _method3_transfer1(source_text, keywords):
    """方法3×転送1: キーワード検索してそのまま転送（135件）

    ソーステキストの行からキーワードにマッチする行を見つけ、
    その行の値（=以降）を返す。
    """
    lines = source_text.split("\n")
    for keyword in keywords:
        for line in lines:
            if keyword in line:
                # "キーワード=値" のパターンから値を抽出
                if "=" in line:
                    return line.split("=", 1)[1].strip()
                return line.strip()
    return ""


def _method3_transfer2(source_text, keywords, transform_value):
    """方法3×転送2: 検索して別の文字に変換して転送（694件）

    キーワードにマッチしたら、transform_valueの値を返す。
    """
    lines = source_text.split("\n")
    for keyword in keywords:
        for line in lines:
            if keyword in line:
                # マッチしたらtransform_valueを返す
                return transform_value or ""
    return ""


def _method3_transfer3(source_text, keywords):
    """方法3×転送3: キーワードの右側（行末）を転送（19件）

    例: "書体=楷書体" でキーワード"書体"→ "楷書体"を返す
    """
    lines = source_text.split("\n")
    for keyword in keywords:
        for line in lines:
            if keyword in line:
                # キーワードの右側を取得
                idx = line.find(keyword)
                right = line[idx + len(keyword):].strip()
                # 先頭の=:等の区切り文字を除去
                right = re.sub(r'^[=:：\s]+', '', right)
                return right
    return ""


def _method3_transfer4(source_text, keywords, split_index):
    """方法3×転送4: キーワード右の値をスペースで分割してN番目を転送（12件）"""
    right = _method3_transfer3(source_text, keywords)
    if not right:
        return ""
    parts = right.split()
    idx = (split_index or 1) - 1  # 1-based→0-based
    if 0 <= idx < len(parts):
        return parts[idx]
    return right


def _method3_transfer10(tracker, source_text, source_col, keywords, remove_parts):
    """方法3×転送10: 不要行・不要部分を除いて転送（232件）

    ★行を消費する（tracker.consume呼び出し）
    """
    # 「項目・選択肢」列からの場合はtrackerを使う
    if source_col == "項目・選択肢" or not source_col:
        lines = tracker.get_all_lines()
        use_tracker = True
    else:
        lines = source_text.split("\n")
        use_tracker = False

    result_lines = []
    removed_indices = []

    for i, line in enumerate(lines if not use_tracker else tracker.original_lines):
        if use_tracker and i in tracker.consumed:
            continue

        stripped = line.strip()
        if not stripped:
            continue

        # 不要行チェック（ワイルドカード対応）
        is_remove = False
        for pattern in (keywords or []) + (remove_parts or []):
            if _wildcard_match(stripped, pattern):
                is_remove = True
                break

        if is_remove:
            # 不要行のみ消費（結果行は消費しない→転送20/21/22で使える）
            if use_tracker:
                removed_indices.append(i)
            continue

        # 不要部分の削除
        cleaned = stripped
        for part in remove_parts or []:
            if not _has_wildcard(part):
                cleaned = cleaned.replace(part, "")
        cleaned = cleaned.strip()

        if cleaned:
            result_lines.append(cleaned)

    # 不要行のみ消費をマーク
    if use_tracker:
        tracker.consume(removed_indices)

    return "\n".join(result_lines)


def _method3_transfer12(source_text, keywords):
    """方法3×転送12: 検索して右から行末を次の新しい行に転送（4件）

    兄弟スタンプ等で複数の作成名を分離するために使用。
    ※現在は最初のマッチの右側を返す簡易実装。
    """
    lines = source_text.split("\n")
    for keyword in keywords:
        for line in lines:
            if keyword in line:
                idx = line.find(keyword)
                right = line[idx + len(keyword):].strip()
                right = re.sub(r'^[=:：\s]+', '', right)
                return right
    return ""


def _method3_transfer20(tracker, remove_parts):
    """方法3×転送20: 残った行から不要行・不要部分を除いて転送（23件）

    ★get_remaining_lines()を使用
    """
    remaining = tracker.get_remaining_lines()
    result_lines = []

    for line in remaining:
        stripped = line.strip()
        if not stripped:
            continue

        # 不要行チェック
        is_remove = False
        for pattern in remove_parts or []:
            if _wildcard_match(stripped, pattern):
                is_remove = True
                break

        if is_remove:
            # 残り行からも消費
            tracker.consume_by_content([line])
            continue

        # 不要部分の削除
        cleaned = stripped
        for part in remove_parts or []:
            if not _has_wildcard(part):
                cleaned = cleaned.replace(part, "")
        cleaned = cleaned.strip()

        if cleaned:
            result_lines.append(cleaned)

    return "\n".join(result_lines)


_KNOWN_NON_NAME_WORDS = {
    "ゆめかわ", "ポップカー", "ワーキングブルー", "ドレミファイエロー",
    "ナチュラルグレージュ", "ベリーピンク", "なし", "undefined",
}


def _method3_transfer21(tracker, char_type):
    """方法3×転送21: 残った行でひらがな/漢字/ローマ字を判別して転送（4件）

    char_type: 1=ひらがな, 2=漢字, 3=ローマ字
    """
    remaining = tracker.get_remaining_lines()
    result_lines = []

    for line in remaining:
        stripped = line.strip()
        if not stripped:
            continue
        # ボックス名・既知の非名前ワードを除外
        if stripped in _KNOWN_NON_NAME_WORDS:
            continue

        detected = _detect_char_type_simple(stripped)
        if char_type == 1 and detected == "hiragana":
            result_lines.append(stripped)
        elif char_type == 2 and detected == "kanji":
            result_lines.append(stripped)
        elif char_type == 3 and detected == "roman":
            result_lines.append(stripped)

    return "\n".join(result_lines)


def _method3_transfer22(tracker, target_line_number):
    """方法3×転送22: 残った行で指定行番号の内容を転送（6件）"""
    remaining = tracker.get_remaining_lines()
    idx = (target_line_number or 1) - 1  # 1-based→0-based
    if 0 <= idx < len(remaining):
        return remaining[idx].strip()
    return ""


def _method4_formula(formula_str):
    """方法4: 数式文字列を入力（そのまま文字列として返す）"""
    return formula_str or ""


# === ユーティリティ ===

def _wildcard_match(text, pattern):
    """ワイルドカード(*)対応のマッチング。

    外注マクロの設定シートでは「*」を任意文字列として使用。
    例: "商品[*]:*円" は "商品[8]:1,000円" にマッチ
    """
    if not pattern:
        return False

    # *を含まない場合は単純な包含チェック
    if "*" not in pattern:
        return pattern in text

    # *を正規表現の.*に変換
    regex_pattern = "^" + re.escape(pattern).replace(r"\*", ".*") + "$"
    try:
        return bool(re.match(regex_pattern, text))
    except re.error:
        return pattern.replace("*", "") in text


def _has_wildcard(pattern):
    """パターンにワイルドカードが含まれるか"""
    return "*" in pattern if pattern else False


def _detect_char_type_simple(text):
    """簡易的な文字種判別"""
    if not text:
        return "unknown"

    # スペース・記号を除去して判定
    chars = re.sub(r'[\s\-・、。（）\(\)「」『』\[\]【】]', '', text)
    if not chars:
        return "unknown"

    hiragana_count = sum(1 for c in chars if '\u3040' <= c <= '\u309f')
    katakana_count = sum(1 for c in chars if '\u30a0' <= c <= '\u30ff')
    roman_count = sum(1 for c in chars if c.isascii() and c.isalpha())
    kanji_count = sum(1 for c in chars
                      if unicodedata.category(c).startswith('Lo')
                      and not ('\u3040' <= c <= '\u309f')
                      and not ('\u30a0' <= c <= '\u30ff'))

    total = len(chars)
    if total == 0:
        return "unknown"

    # 8割以上がその文字種なら判定
    if hiragana_count / total >= 0.8:
        return "hiragana"
    if kanji_count / total >= 0.5:
        return "kanji"
    if roman_count / total >= 0.8:
        return "roman"
    if katakana_count / total >= 0.8:
        return "katakana"

    return "mixed"
