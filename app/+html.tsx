// app/+html.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        
        {/* ▼▼▼ PWA/アイコン設定：相対パスにして favicon も明示する ▼▼▼ */}
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="icon" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="theme-color" content="#ffffff" />
        
        {/* SEO / SNSシェア設定 (OGP) */}
        <meta name="description" content="大学生協のミールパスを賢く使い切るための計算・管理アプリです。" />
        <meta property="og:title" content="ミールパス計算アプリ" />
        <meta property="og:description" content="大学生協のミールパスを賢く使い切るための計算・管理アプリです。" />
        <meta property="og:image" content="https://meal-pass-app.vercel.app/icon-512.png" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://meal-pass-app.vercel.app/" />
        <meta name="twitter:card" content="summary_large_image" />
        {/* ▲▲▲▲▲▲ */}

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}