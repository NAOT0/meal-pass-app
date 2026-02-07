import "../global.css";
import { Stack } from "expo-router";
import { View, Platform } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react'; // ★追加

export default function RootLayout() {

  // ▼▼▼ PWA化のための追記ブロック ▼▼▼
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // 1. Service Worker の登録
      if ('serviceWorker' in navigator) {
        const registerSW = () => {
          navigator.serviceWorker.register('/sw.js').then(
            (registration) => console.log('SW registered: ', registration),
            (error) => console.log('SW registration failed: ', error)
          );
        };
        if (document.readyState === 'complete') registerSW();
        else window.addEventListener('load', registerSW);
      }

      // 2. マニフェストとアイコンの動的注入（開発環境でも確実に読み込ませる）
      const addLink = (rel: string, href: string) => {
        if (!document.querySelector(`link[href="${href}"]`)) {
          const link = document.createElement('link');
          link.rel = rel;
          link.href = href;
          document.head.appendChild(link);
        }
      };
      addLink('manifest', '/site.webmanifest');
      addLink('icon', '/icon-512.png');
      addLink('apple-touch-icon', '/icon-512.png');
    }
  }, []);
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-gray-200">
        <View className={`flex-1 bg-white ${Platform.OS === 'web' ? 'w-full max-w-[480px] mx-auto shadow-2xl overflow-hidden min-h-screen' : ''}`}>
            <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="game_modal" options={{ presentation: 'modal' }} />
            </Stack>
        </View>
        </View>
    </GestureHandlerRootView>
  );
}