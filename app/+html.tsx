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
        {/* ▲▲▲▲▲▲ */}

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}