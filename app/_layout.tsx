import "../global.css";
import { Stack } from "expo-router";
import { View, Platform } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react'; // ★追加

export default function RootLayout() {

  // ▼▼▼ PWA化のための追記ブロック ▼▼▼
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // 1. Service Worker の登録
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.log('SW registration ignored: ', err);
        });
      });
    }

    // 2. マニフェストとアイコンの動적注入 (レンダリングをブロックしないよう少し遅らせる)
    const timer = setTimeout(() => {
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
    }, 1000);

    return () => clearTimeout(timer);
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