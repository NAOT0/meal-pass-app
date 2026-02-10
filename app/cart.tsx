import React from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { X, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useCartStore } from '../src/store/useCartStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fillBudget } from '../src/features/recommendation/logic';

export default function CartModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { 
    currentList, lockedIds, quantities, budget, 
    toggleItemLock, updateQuantity, deleteItem, 
    products, filters 
  } = useCartStore();

  const currentTotal = currentList.filter(p => lockedIds.has(p.id)).reduce((sum, item) => {
    return sum + (item.price * (quantities[item.id] || 1));
  }, 0);

  const remaining = Math.max(0, budget - currentTotal);
  const cartItems = currentList.filter(item => lockedIds.has(item.id));
  const recommendations = currentList.filter(item => !lockedIds.has(item.id));

  // Check if there's anything left in the master list that fits the remaining budget and filters
  const canSuggestMore = products.some(p => 
    p.price <= remaining && 
    p.is_active && 
    !lockedIds.has(p.id) &&
    (p.category_id ? filters[p.category_id] : true)
  );

  const hasVisibleSuggestions = recommendations.length > 0 || canSuggestMore;

  return (
    <SafeAreaView className="flex-1 bg-warm-beige">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="pt-10 px-6 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-xl font-bold text-[#2D332B]">買い物かご</Text>
          <Text className="text-[10px] text-sage-green font-medium opacity-70">全 {cartItems.length} 点</Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="p-2 bg-white border border-[#E8E6E0] rounded-full"
        >
          <X size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* Shopping List */}
        <View className="px-6 pt-6">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-sm font-bold text-[#2D332B]">🛒 買うものリスト</Text>
            <Text className="text-sm font-bold text-gray-400">合計 ¥{currentTotal}</Text>
          </View>
          
          <View className="space-y-3">
            {cartItems.length === 0 ? (
              <View className="border-2 border-dashed border-[#E8E6E0] rounded-2xl p-8 items-center justify-center bg-white/50">
                <Text className="text-gray-400 text-sm">カートは空です</Text>
              </View>
            ) : (
              cartItems.map((item) => {
                const qty = quantities[item.id] || 1;
                const renderRightActions = () => (
                  <View className="bg-red-500 justify-center items-center w-20 rounded-r-2xl h-full">
                    <Trash2 size={24} color="white" />
                  </View>
                );

                return (
                  <View key={item.id} className="mb-3">
                    <Swipeable
                      renderRightActions={renderRightActions}
                      onSwipeableOpen={() => deleteItem(item.id)}
                      overshootRight={false}
                    >
                      <View className="bg-white border-2 border-border-blue flex-row items-center justify-between p-4 rounded-2xl shadow-sm">
                        <View className="flex-1">
                          <Text className="font-bold text-[15px]" numberOfLines={1}>{item.name}</Text>
                          <Text className="text-sm text-gray-500 font-medium">¥{item.price}</Text>
                        </View>
                        <View className="flex-row items-center gap-4">
                          <View className="flex-row items-center bg-[#F4F7F9] rounded-xl px-2 py-1">
                            <TouchableOpacity onPress={() => updateQuantity(item.id, -1)}>
                              <Minus size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                            <Text className="text-sm font-bold w-6 text-center">{qty}</Text>
                            <TouchableOpacity onPress={() => updateQuantity(item.id, 1)}>
                              <Plus size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </Swipeable>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Suggestions Section */}
        {recommendations.length > 0 && (
          <View className="px-6 pt-10">
            <Text className="text-sm font-bold text-[#2D332B] mb-4">
              💡 あと{remaining}円で買うならこれ！
            </Text>
            
            <View className="space-y-3">
              {recommendations.map((item) => {
                const renderRightActions = () => (
                  <View className="bg-red-500 justify-center items-center w-20 rounded-r-2xl h-full">
                    <Trash2 size={24} color="white" />
                  </View>
                );

                return (
                  <View key={item.id} className="mb-3">
                    <Swipeable
                      renderRightActions={renderRightActions}
                      onSwipeableOpen={() => deleteItem(item.id)}
                      overshootRight={false}
                    >
                      <View className="bg-[#F2F2F2] flex-row items-center justify-between p-4 rounded-2xl">
                        <View className="flex-1">
                          <Text className="font-bold text-[15px]" numberOfLines={1}>{item.name}</Text>
                          <Text className="text-sm text-gray-500 font-medium">¥{item.price}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => toggleItemLock(item.id)}
                          className="bg-white px-5 py-2 rounded-xl border border-[#E8E6E0] shadow-sm active:scale-95"
                        >
                          <Text className="text-xs font-bold text-sage-green">追加</Text>
                        </TouchableOpacity>
                      </View>
                    </Swipeable>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Button */}
      <View 
        className="px-6 pb-10 pt-4 bg-transparent absolute bottom-0 left-0 right-0"
      >
        <TouchableOpacity 
          onPress={() => router.back()}
          activeOpacity={0.9}
          className="w-full bg-sage-green py-4 rounded-full shadow-lg items-center justify-center"
        >
          <Text className="text-white font-bold text-lg">ホームに戻る</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
