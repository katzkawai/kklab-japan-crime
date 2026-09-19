# 編集・再ビルド

公開するのは `docs/` です。GitHub Actionsはコミット済み成果物と原本・CSVを検証して配信するため、デプロイ時に外部の統計やAPIに依存しません。

## データの再生成

```bash
python3 scripts/prepare_data.py
```

原本が変更されると、表の形・年次・総数などの検証で停止することがあります。原本の差し替え時は取得日、出典、範囲、法改正等の注記を確認してください。

`data/reviewed.json` を `app/src/data.json` に反映する際は、後者の `id` を維持し、作業中は `buildStatus` を `updating`、完成時は `complete` にします。

## UIの編集

`app/src/content/dashboard/DashboardContent.jsx` と `dashboard.css`、配色は `app/src/theme.css` を編集します。アプリ内の操作による表示編集はブラウザ内に保存され、公開リポジトリのデータは変更しません。

初回作成にはCodex Dataプラグインのビルド済みランタイムを利用しました。プラグインがある環境では `app/AGENTS.md` に従い、次のコマンドを使えます。

```bash
env -u CODEX_SESSION_ID -u CODEX_THREAD_ID node /path/to/data-analytics/scripts/data-app.mjs build --project-dir "$PWD/app" --separate-data
```

`/path/to/data-analytics` はインストール済みDataプラグインのルートに置き換えてください。ローカルの会話識別子を公開ビルドへ含めないため、該当環境変数を外しています。

コピー済みソースには `app/package.json` とロックファイルも含まれています。通常のReact/Viteのソースビルド経路は `cd app && npm ci && npm run build` です。初回公開で使用・検証した成果物は上記のプラグインビルドによるものです。

## 公開ファイルの作成

```bash
python3 scripts/package_site.py
python3 scripts/verify_site.py
python3 -m http.server 4173 --directory docs
```

パッケージ処理はビルド済みアプリをコピーし、日本語のHTML言語・ページ説明・作成者・favicon等の公開用メタデータ、CSV、ハッシュ一覧を付加します。ビルダーが保持していたローカル会話へのリンク用メタデータも公開時に除去します。アプリのコードや数値は再計算しません。

ブラウザで4画面と期間・指標の切り替え、出典パネル、CSVダウンロードを確認してから `docs/` をコミットします。`main` にプッシュすると `.github/workflows/pages.yml` が検証・デプロイします。
