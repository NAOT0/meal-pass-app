import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Animated } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

export function UpdateNavigator() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Service Workerの更新を検知
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新しいService Workerがインストールされ、待機状態になったら通知
                setHasUpdate(true);
              }
            });
          }
        });
      });

      // すでに待機中の更新がある場合
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg?.waiting) {
          setHasUpdate(true);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (hasUpdate) {
      Animated.spring(slideAnim, {
        toValue: 20,
        useNativeDriver: true,
        tension: 50,
        friction: 7
      }).start();
    }
  }, [hasUpdate]);

  const handleUpdate = () => {
    // キャッシュをクリアしてリロードを促す
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  };

  if (!hasUpdate) return null;

  return (
    <Animated.View 
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        transform: [{ translateY: slideAnim }],
        zIndex: 9999,
        alignItems: 'center',
        paddingHorizontal: 20
      }}
    >
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={handleUpdate}
        className="bg-blue-600 flex-row items-center px-6 py-3 rounded-full shadow-lg border border-blue-400"
      >
        <RefreshCw size={18} color="white" className="mr-3" />
        <View>
          <Text className="text-white font-bold text-sm">新しいバージョンが利用可能です</Text>
          <Text className="text-blue-100 text-xs text-center">タップして更新を反映</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
