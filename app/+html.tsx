import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// このファイルはWeb版の「index.html」の役割をします
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        
        {/* ▼▼▼ これが超重要！マニフェストを読み込むタグ ▼▼▼ */}
        <link rel="manifest" href="/manifest.json" />
        {/* ▲▲▲▲▲▲ */}

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}