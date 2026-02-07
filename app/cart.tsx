
import React from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { X, ShoppingCart, Plus, Trash2 } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useCartStore } from '../src/store/useCartStore';
import { Button } from '../src/components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fillBudget } from '../src/features/recommendation/logic';

export default function CartModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentList, lockedIds, quantities, budget, toggleItemLock, updateQuantity, deleteItem } = useCartStore();

  // We need budget and filters for delete logic. 
  // For now, let's just implement the UI. 
  // Ideally these would be in a store too, but let's keep it simple.
  
  const currentTotal = currentList.filter(p => lockedIds.has(p.id)).reduce((sum, item) => {
    return sum + (item.price * (quantities[item.id] || 1));
  }, 0);

  const remaining = Math.max(0, budget - currentTotal);
  const cartItems = currentList.filter(item => lockedIds.has(item.id));
  const recommendations = currentList.filter(item => !lockedIds.has(item.id));

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-4 border-b border-gray-200 flex-row justify-between items-center bg-white shadow-sm">
        <View className="flex-row items-center gap-2">
            <ShoppingCart size={24} color="#111827" />
            <Text className="font-bold text-xl text-gray-900">買い物かご ({cartItems.length})</Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="p-2 bg-gray-100 rounded-full"
        >
          <X size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* 1. Cart Items List */}
        <View className="mb-10">
          <View className="flex-row justify-between items-end mb-6 px-2">
              <Text className="font-bold text-gray-500 text-sm">カート内の商品</Text>
              <Text className="font-bold text-gray-900 text-lg">合計 ¥{currentTotal}</Text>
          </View>
          <View>
          
          {cartItems.length === 0 ? (
            <View className="py-12 items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                <Text className="text-gray-400">カートは空です</Text>
            </View>
          ) : (
            cartItems.map((item) => {
              const qty = quantities[item.id] || 1;
              const renderRightActions = () => (
                <View className="bg-red-500 justify-center items-center w-20 rounded-r-xl ml-[-20] pl-4">
                  <Trash2 size={24} color="white" />
                </View>
              );

              return (
                <View key={item.id} className="mb-6">
                  <Swipeable
                    renderRightActions={renderRightActions}
                    onSwipeableOpen={() => deleteItem(item.id)}
                    overshootRight={false}
                  >
                    <View className="flex-row items-center p-4 rounded-xl border bg-white border-blue-100 shadow-sm h-24 w-[92%] self-center">
                      <View className="flex-1">
                        <Text className="font-bold text-lg text-blue-900" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-gray-500 font-bold">¥{item.price}</Text>
                      </View>
                      <View className="items-end justify-center">
                        <View className="flex-row items-center bg-gray-100 rounded-lg p-1">
                          <Button title="-" variant="ghost" onPress={() => updateQuantity(item.id, -1)} className="w-8 h-8 p-0" />
                          <Text className="font-bold text-gray-800 w-8 text-center">{qty}</Text>
                          <Button title="+" variant="ghost" onPress={() => updateQuantity(item.id, 1)} className="w-8 h-8 p-0" />
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

        {/* Recommendations */}
        {recommendations.length > 0 && (
            <View>
                <View className="mb-6 px-2">
                    <Text className="font-bold text-gray-500 text-sm">あと ¥{remaining} で買うならこれ！</Text>
                </View>
                <View>
                    {recommendations.map((item) => {
                      const renderRightActions = () => (
                        <View className="bg-red-500 justify-center items-center w-20 rounded-r-xl ml-[-20] pl-4">
                          <Trash2 size={24} color="white" />
                        </View>
                      );
                      
                      return (
                        <View key={item.id} className="mb-6">
                          <Swipeable
                            renderRightActions={renderRightActions}
                            onSwipeableOpen={() => deleteItem(item.id)}
                            overshootRight={false}
                          >
                            <View className="flex-row items-center p-4 rounded-xl border border-gray-200 bg-gray-50/50 shadow-sm h-24 w-[92%] self-center">
                               <View className="flex-1">
                                 <Text className="font-bold text-lg text-gray-700" numberOfLines={1}>
                                   {item.name}
                                 </Text>
                                 <View className="flex-row items-end gap-2">
                                     <Text className="text-gray-500 font-bold">¥{item.price}</Text>
                                     <View className="bg-amber-100 px-1.5 py-0.5 rounded">
                                       <Text className="text-[10px] text-amber-700 font-bold">おすすめ</Text>
                                     </View>
                                 </View>
                               </View>
                               
                               <Button
                                 title="追加"
                                 variant="primary"
                                 onPress={() => toggleItemLock(item.id)}
                                 className="bg-emerald-500 shadow-sm px-6 h-11"
                                 textClassName="text-white font-bold"
                                 icon={<Plus size={18} color="white" />}
                               />
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
        className="p-4 bg-white border-t border-gray-100"
        style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }}
       >
        <Button 
            title="終了" 
            onPress={() => router.back()} 
            className="w-full bg-gray-900 py-4"
        />
      </View>
    </SafeAreaView>
  );
}
