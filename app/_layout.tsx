import "../global.css";
import { Stack } from "expo-router";
import { View, Platform } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
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
