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
        
        {/* ▼▼▼ PWA設定：マニフェストだけでなく、アイコンも直接指定する ▼▼▼ */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="theme-color" content="#ffffff" />
        {/* ▲▲▲▲▲▲ */}

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}