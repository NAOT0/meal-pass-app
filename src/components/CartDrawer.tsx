
import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { X, ShoppingCart, Plus, Trash2 } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Database } from '../types/schema';
import { Button } from './Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Product = Database['public']['Tables']['products']['Row'];

interface CartDrawerProps {
  visible: boolean;
  onClose: () => void;
  cartItems: Product[];
  quantities: Record<string, number>;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onToggleLock: (productId: string) => void;
  lockedIds: Set<string>; // To show "Confirmed" status
  
  // Recommendation Props
  allProducts: Product[];
  candidates: Product[]; // Receive from parent
  currentTotal: number;
  totalBudget: number;
  onAddRecommended: (product: Product) => void;
  onDeleteItem: (productId: string) => void;
}

export const CartDrawer = ({
  visible,
  onClose,
  cartItems,
  quantities,
  onUpdateQuantity,
  onToggleLock,
  lockedIds,
  allProducts,
  candidates,
  currentTotal,
  totalBudget,
  onAddRecommended,
  onDeleteItem
}: CartDrawerProps) => {
  const insets = useSafeAreaInsets();
  const remaining = Math.max(0, totalBudget - currentTotal);

  // Recommendations are now passed from parent (candidates)
  // We can filter if needed, but parent loop logic should handle it.
  // Parent logic provides "candidates to fill the budget". 
  // We just display them.
  const recommendations = candidates;

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="pageSheet" 
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-50">
          {/* Swipe Handle */}
          <TouchableOpacity 
            onPress={onClose}
            className="w-full items-center pt-3 pb-1"
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </TouchableOpacity>

          {/* Header */}
          <View className="px-4 pb-4 border-b border-gray-200 flex-row justify-between items-center bg-gray-50 rounded-t-3xl">
            <View>
                <View className="flex-row items-center gap-2">
                    <ShoppingCart size={24} color="#111827" />
                    <Text className="font-bold text-xl text-gray-900">買い物かご ({cartItems.length})</Text>
                </View>
                <Text className="text-xs text-gray-500 mt-1 ml-1">
                    予算: {totalBudget > 0 ? `¥${totalBudget}` : '未設定'}
                </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2 bg-gray-200 rounded-full">
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
            {/* 1. Cart Items List */}
            <View className="gap-3 mb-8">
              <View className="flex-row justify-between items-end mb-2 px-2">
                  <Text className="font-bold text-gray-500 text-sm">カートに入っている商品</Text>
                  <Text className="font-bold text-gray-900 text-lg">合計 ¥{currentTotal}</Text>
              </View>
              {cartItems.length === 0 ? (
                <View className="py-8 items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white">
                    <Text className="text-gray-400">カートは空です</Text>
                </View>
              ) : (
                cartItems.map((item) => {
                  const isLocked = lockedIds.has(item.id);
                  const qty = quantities[item.id] || 1;

                  const renderRightActions = () => (
                           <View className="bg-red-500 justify-center items-center w-20 rounded-r-lg ml-[-20] pl-4">
                               <Trash2 size={24} color="white" />
                           </View>
                       );

                       return (
                        <Swipeable
                            key={item.id}
                            renderRightActions={renderRightActions}
                            onSwipeableOpen={() => onDeleteItem(item.id)}
                            overshootRight={false}
                        >
                           <View className={`flex-row items-center p-4 rounded-xl border ${isLocked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'} shadow-sm`}>
                               <View className="flex-1">
                                   <Text className={`font-bold text-lg ${isLocked ? 'text-blue-900' : 'text-gray-800'}`}>
                                       {item.name}
                                   </Text>
                                   <View className="flex-row items-end gap-2">
                                       <Text className="text-gray-500">¥{item.price}</Text>
                                       {item.is_temporary && <Text className="text-xs text-purple-500 font-bold bg-purple-100 px-1 rounded">限定</Text>}
                                   </View>
                               </View>
                               
                               <View className="items-end gap-2">
                                   <View className="flex-row items-center gap-2">
                                       <View className="flex-row items-center bg-gray-100 rounded-lg">
                                           <Button title="-" variant="ghost" onPress={() => onUpdateQuantity(item.id, -1)} className="w-8 h-8 p-0" textClassName="text-lg text-gray-600" />
                                           <Text className="font-bold text-gray-800 w-6 text-center">{qty}</Text>
                                           <Button title="+" variant="ghost" onPress={() => onUpdateQuantity(item.id, 1)} className="w-8 h-8 p-0" textClassName="text-lg text-gray-600" />
                                       </View>
                                       {/* Delete Button Removed (Swipe to delete) */}
                                   </View>
                                   <Button
                                     title={isLocked ? "確定中" : "選択"}
                                     variant={isLocked ? "primary" : "outline"}
                                     onPress={() => onToggleLock(item.id)}
                                     className={`px-3 py-1 ${isLocked ? "bg-blue-600" : ""} min-w-[60px]`}
                                     textClassName="text-xs"
                                   />
                               </View>
                           </View>
                        </Swipeable>
                       );
                })
              )}
            </View>

            {/* Divider */}
            {recommendations.length > 0 && (
                <View className="items-center mb-6">
                    <View className="h-[1px] bg-gray-300 w-full mb-4" />
                    <View className="bg-emerald-50 px-4 py-1 rounded-full -mt-8 border border-emerald-100">
                        <Text className="text-emerald-700 font-bold text-sm">💡 残金 ¥{remaining} で買えるおすすめ</Text>
                    </View>
                </View>
            )}

            {/* 2. Recommendations List */}
            <View className="gap-3">
                {recommendations.map((item) => (
                    <View 
                      key={item.id} 
                      className="flex-row items-center p-4 rounded-xl border-2 border-dashed border-gray-300 bg-white/50 opacity-90"
                    >
                       <View className="flex-1 opacity-60">
                         <Text className="font-bold text-lg text-gray-700">
                           {item.name}
                         </Text>
                         <View className="flex-row items-end gap-2">
                             <Text className="text-gray-500 font-bold">¥{item.price}</Text>
                             <Text className="text-xs text-gray-400 border border-gray-200 px-1 rounded">おすすめ</Text>
                         </View>
                       </View>
                       
                       <Button
                         title="追加"
                         variant="primary"
                         onPress={() => onToggleLock(item.id)}
                         className="bg-emerald-500 shadow-sm px-6 h-10"
                         textClassName="text-white font-bold"
                         icon={<Plus size={18} color="white" />}
                       />
                    </View>
                ))}
            </View>

          </ScrollView>
      </View>
    </Modal>
  );
};
