# プロジェクト設計・仕様ドキュメント (ARCHITECTURE.md)

本ドキュメントは、Expo Router をベースとした「ミールパス計算アプリ」の設計思想、ディレクトリ構造、および重要な技術的決定事項をまとめたものです。開発チーム内でのコンテキスト同期と、技術的負債の解消を目的としています。

---

## 1. プロジェクト概要 (Project Overview)

### アプリの目的
大学生協のミールパス（1日の利用限度額がある食事パス）を、計算の手間なく最大限スマートに活用するためのモバイル・Web併用アプリです。
バーコードスキャンによる価格取得、予算内での組み合わせ提案、ユーザー協力による商品データの精査（仕分けゲーム）などの機能を提供します。

### 主要技術スタック
- **Frontend**: Expo (React Native), Expo Router (v3系)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Backend / DB**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel (for Web/PWA), Expo Application Services (EAS)
- **Icons**: Lucide React Native

---

## 2. ディレクトリ構成と役割 (Directory Structure)

```text
.
├── app/                # Expo Router のベースディレクトリ（ファイルベースルーティング）
│   ├── (auth)/         # 認証関連の画面（未実装または分離予定）
│   ├── mng-panel-x9/   # 管理画面（商品データ管理、一括更新、インポート）
│   ├── _layout.tsx     # ルートレイアウト。PWAの動的設定や全体Providerを定義
│   ├── +html.tsx       # 静的HTMLテンプレート。SEO、OGP、PWAリンクの定義
│   ├── index.tsx       # メイン画面（予算入力、商品スキャン）
│   └── game_modal.tsx  # 仕分けゲーム画面
├── src/                # ビジネスロジック、コンポーネント、定数
│   ├── components/     # 再利用可能なUIコンポーネント
│   ├── features/       # フィーチャーベースのロジック（計算アルゴリズム等）
│   ├── lib/            # Supabase クライアント等の初期化設定
│   └── types/          # TypeScript の型定義（Database, Schema等）
├── public/             # 静的ファイル（Web版で使用）
│   ├── site.webmanifest # PWAの定義ファイル
│   ├── sw.js           # Service Worker（オフライン/PWA認識用）
│   └── *.png           # 各種アイコン、ファビコン
├── assets/             # アプリバイナリ用の画像資産
└── app.json            # Expo の基本構成設定
```

### `_layout.tsx` と `+html.tsx` の役割
- **`app/_layout.tsx`**: 実行時（Runtime）の制御を行います。全画面に共通する UI（GestureHandler、Viewのコンテナ）や、Web実行時の動的処理（Service Workerの登録、Manifestタグの動的注入）を `useEffect` で担います。
- **`app/+html.tsx`**: 生成時（Build/Server-side）の制御を行います。Web版のベースとなる `<html>` 構造を定義し、SNS共有時に必要な **OGPタグ (metaタグ)** や初期読み込みに必要なリンクを記述します。SNSクローラーは JavaScript を実行しないため、こちらへの静的な記述が必須です。

---

## 3. 重要な技術的決定事項 (Key Technical Decisions)

### PWA対応の仕組み
通常、Expo は `app.json` の `web` セクションから PWA の設定を自動生成しますが、開発環境での認識安定性と、Service Worker の挙動を細かく制御するために **`public/` フォルダを用いたマニュアル管理** を採用しています。
- **`site.webmanifest`**: 従来の `manifest.json` との名称競合を避けるためこの名称を採用。
- **動的注入**: Web の Metro サーバーが自動生成する HTML に干渉されないよう、`_layout.tsx` から DOM 経由でマニフェストを強制的に紐付けています。

### エントリーポイントの変更
- **`index.ts` の排除**: ルートディレクトリにあった `index.ts` を削除（または退避）しました。これは、Expo Router がネイティブ・Webの両方で完全にルーティングを制御するために、`package.json` の `"main": "expo-router/entry"` を優先させる必要があるためです。

### 画像・資産の参照
- **`public` vs `assets`**: 
  - `assets` は Expo の Native コードがビルド時に参照する場所です。
  - `public` は Web サーバーが直接ファイルを配信する場所です。
  - HTML の `<link rel="icon">` やマニフェストからの参照は、Web サーバーから直接取得できる必要があるため、`public` 内の資産を参照します。

---

## 4. 設定ファイルの解説 (Configuration Guide)

- **`app.json`**: アプリの表示名、スラグ、各種プラットフォーム固有設定を管理します。Web セクションでは PWA 用の設定（backgroundColor, themeColor 等）を明記していますが、実際のマニフェスト制御と二重管理にならないよう、`public` 側の設定を最終正としています。
- **`metro.config.js`**: NativeWind (Tailwind) と Expo Router の共存、および `public` フォルダから静的ファイルが配信されるよう構成をデフォルトから継承しています。
- **`babel.config.js`**: `nativewind/babel` と `react-native-reanimated/plugin` を適用し、Web と Native 両方でスムーズなアニメーションとスタイリングを可能にしています。

---

## 5. 主要コンポーネントのロジック (Core Logic)

### データフェッチと状態管理
- **Zustand**: 軽量な状態管理として導入し、スキャンした商品リストや予算の永続化（将来的な対応）を視野に入れています。
- **Supabase**: 商品マスタの取得および、ユーザーの「仕分けゲーム」の結果をリアルタイムに保存するために使用しています。セキュリティは RLS (Row Level Security) により管理されています。

### 商品提案アルゴリズム (`src/features/recommendation/logic.ts`)
1. 現在の予算から確定（ロック）済み商品の価格を控除。
2. 残額に基づき、カテゴリ別の重み付けや栄養バランス、価格効率に応じて最も適切な商品の組み合わせを提案します。
