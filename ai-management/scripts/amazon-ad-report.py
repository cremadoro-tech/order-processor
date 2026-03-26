"""
Amazon広告レポート自動取得スクリプト
Phase 1: AIがメール・パスワードでログイン → OTP画面で停止
Phase 2: ユーザーが手動でOTPを入力後Enter → AIがレポートをダウンロード
"""

import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from browser_use import Agent, BrowserSession, BrowserProfile
from browser_use.llm.anthropic.chat import ChatAnthropic

load_dotenv(Path(__file__).parent.parent / ".env")

AMAZON_EMAIL = os.getenv("AMAZON_SELLER_EMAIL")
AMAZON_PASSWORD = os.getenv("AMAZON_SELLER_PASSWORD")
OUTPUT_DIR = Path(__file__).parent.parent / "02_finance" / "amazon-ads"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


async def main():
    llm = ChatAnthropic(
        model="claude-sonnet-4-6",
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        timeout=60,
    )

    # ブラウザ起動（リモートデバッグポート付き・表示モード）
    browser_session = BrowserSession(
        browser_profile=BrowserProfile(
            headless=False,
            keep_alive=True,  # セッション間でブラウザを維持
            downloads_dir=str(OUTPUT_DIR),  # ダウンロード先を明示指定
        )
    )
    await browser_session.start()

    # CDPのURLを取得（Phase 2で再接続するため）
    cdp_url = browser_session.browser_profile.cdp_url
    print(f"ブラウザ接続URL: {cdp_url}")

    # === Phase 1: ログイン ===
    print("\n" + "=" * 50)
    print("Phase 1: ログイン中...")
    print("=" * 50)

    login_task = f"""
    Amazonセラーセントラルにログインしてください。

    手順:
    1. https://sellercentral.amazon.co.jp にアクセス
    2. メール: {AMAZON_EMAIL} を入力して「次へ」
    3. パスワード: {AMAZON_PASSWORD} を入力して「ログイン」
    4. 2段階認証（OTP）画面が表示されたら、入力せず完了と報告してください

    重要: OTPは入力しないこと。2FA画面が出たらそこで完全に停止。
    """

    agent1 = Agent(task=login_task, llm=llm, browser_session=browser_session)
    await agent1.run()

    # === ユーザーが手動でOTPを入力 ===
    print()
    print("=" * 50)
    print("【操作してください】")
    print("ブラウザのOTP入力欄にAuthenticatorアプリの6桁を入力してください。")
    print("ログインが完了したらここに戻ってEnterを押してください。")
    print("=" * 50)
    input("ログイン完了後 → Enter: ")

    # === Phase 2: 新しいセッションで同じブラウザに再接続 ===
    print("\nPhase 2: 広告レポートをダウンロード中...")

    browser_session2 = BrowserSession(
        browser_profile=BrowserProfile(
            cdp_url=cdp_url,
            keep_alive=True,
        )
    )
    await browser_session2.start()

    report_task = """
    現在Amazonセラーセントラルにログイン済みです。
    広告レポートをダウンロードしてください。

    手順:
    1. 上部メニュー「広告」>「レポート」に移動
    2. 「レポートを作成」から以下の3種類を順番に作成・ダウンロード:
       - スポンサープロダクト > キャンペーンレポート（直近30日）
       - スポンサープロダクト > 検索用語レポート（直近30日）
       - スポンサープロダクト > 広告グループレポート（直近30日）
    3. 各CSVがダウンロードされたらファイル名を報告してください

    注意: レポート生成に時間がかかる場合は最大3分待つこと
    """

    agent2 = Agent(task=report_task, llm=llm, browser_session=browser_session2)
    result = await agent2.run()

    print("\n=== 実行結果 ===")
    try:
        final = result.final_result()
        print(final if final else "完了")
    except Exception:
        print("レポートダウンロード処理が完了しました")

    await browser_session2.stop()


if __name__ == "__main__":
    asyncio.run(main())
