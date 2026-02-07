import { View, Text, TextInput, ScrollView, SafeAreaView, Platform, LayoutAnimation, UIManager, TouchableOpacity } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { signInAnonymously } from '../src/lib/auth';
import { Button } from '../src/components/Button';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { fillBudget, CATEGORY_IDS } from '../src/features/recommendation/logic';
import { Database } from '../src/types/schema';
import { ScanBarcode, Plus, Trash2, ShoppingCart } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

// ... (Product type def)
type Product = Database['public']['Tables']['products']['Row'];

import { useCartStore } from '../src/store/useCartStore';

export default function HomeScreen() {
  const router = useRouter();
  const [budget, setBudget] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  
  /* Global State from Store */
  const { 
    currentList, lockedIds, quantities, 
    setCurrentList, toggleItemLock, updateQuantity, deleteItem, addFromScan 
  } = useCartStore();
  
  // Total Price: ALL Items (Plan Total) - Includes suggestions
  const [totalPrice, setTotalPrice] = useState(0);

  // Locked Total: ONLY Selected Items (For Scanner/Cart)
  const [lockedTotal, setLockedTotal] = useState(0);

  // ... Filter State ...
  const [filters, setFilters] = useState<Record<number, boolean>>({
    [CATEGORY_IDS.BENTO]: true,
    [CATEGORY_IDS.ONIGIRI]: true,
    [CATEGORY_IDS.NOODLE]: true,
    [CATEGORY_IDS.DELI]: true,
    [CATEGORY_IDS.SNACK]: true,
    [CATEGORY_IDS.BREAD]: true,
    [CATEGORY_IDS.DRINK]: true, // Default ON
  });

  // Scanner State
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  // ... CATEGORY_LABELS ...
  const CATEGORY_LABELS: Record<number, string> = {
    [CATEGORY_IDS.BENTO]: '弁当・丼',
    [CATEGORY_IDS.ONIGIRI]: 'おにぎり',
    [CATEGORY_IDS.NOODLE]: '麺類',
    [CATEGORY_IDS.DELI]: '惣菜',
    [CATEGORY_IDS.DRINK]: '飲料',
    [CATEGORY_IDS.SNACK]: 'お菓子・デザート',
    [CATEGORY_IDS.BREAD]: 'パン',
  };

  const toggleFilter = (id: number) => {
    setFilters(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    signInAnonymously();
    fetchProducts();
  }, []);

  useEffect(() => {
    useCartStore.getState().setFilters(filters);
  }, [filters]);

  // Update totals
  useEffect(() => {
    let allSum = 0;
    let lockedSum = 0;

    currentList.forEach(item => {
      const qty = quantities[item.id] || 1;
      const subtotal = item.price * qty;
      
      // Add to Plan Total (Everything)
      allSum += subtotal;

      // Add to Locked Total (Selected Only)
      if (lockedIds.has(item.id)) {
        lockedSum += subtotal;
      }
    });

    setTotalPrice(allSum);
    setLockedTotal(lockedSum);
  }, [currentList, quantities, lockedIds]);

  const fetchProducts = async () => {
    console.log('Fetching products...');
    const now = new Date().toISOString();
    
    // Fetch active products that are NOT expired
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*)')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`);
    
     if (data) {
      setProducts(data as any);
      useCartStore.getState().setProducts(data as any);
    }
  };

  const handleScan = (product: Product) => {
    addFromScan(product);
  };

  const handleRecommend = (isRefill = false) => {
    const budgetNum = parseInt(budget, 10);
    if (isNaN(budgetNum) || budgetNum <= 0) return;

    // Sync to store for scanner/cart
    useCartStore.getState().setBudget(budgetNum);
    useCartStore.getState().setFilters(filters);
    useCartStore.getState().setProducts(products);

    setLoading(true);
    setTimeout(() => {
      const locksToUse = lockedIds; 
      
      const currentLockedItems = currentList.filter(p => locksToUse.has(p.id));
      
      let extraQuantityCost = 0;
      currentLockedItems.forEach(p => {
        const qty = quantities[p.id] || 1;
        if (qty > 1) {
          extraQuantityCost += p.price * (qty - 1);
        }
      });
      
      const effectiveBudget = budgetNum - extraQuantityCost;

      const allowedIds = new Set<number>();
      Object.entries(filters).forEach(([id, enabled]) => {
        if (enabled) allowedIds.add(Number(id));
      });

      const { list, total } = fillBudget(products, currentList, locksToUse, effectiveBudget, allowedIds);
      
      // Merge new list with existing quantities
      const newQuantities = { ...quantities };
      list.forEach(p => {
        if (!newQuantities[p.id]) newQuantities[p.id] = 1;
      });
      
      // Sync quantities map
      const finalListIds = new Set(list.map(p => p.id));
      Object.keys(newQuantities).forEach(id => {
        if (!finalListIds.has(id)) delete newQuantities[id];
      });

      setLoading(false);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      // Update store
      useCartStore.setState({ currentList: list, quantities: newQuantities });
    }, 300);
  };
  

  return (
    <SafeAreaView className="flex-1 bg-gray-50 h-full">
      <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="mb-6 flex-row justify-between items-start">
          <View>
            <Text className="text-2xl font-bold text-gray-900">ミールパス計算アプリ</Text>
            <Text className="text-sm text-gray-500">ver1.0.0</Text>
          </View>
          {/* Scan Button Only */}
          <View> 
             <Button 
                title="" 
                onPress={() => router.push('/scanner')}
                className="w-14 h-14 rounded-2xl bg-gray-900 items-center justify-center shadow-md border-2 border-white"
                icon={<ScanBarcode color="white" size={24} />}
             />
          </View>
        </View>

        {/* Filter Chips (Horizontal Scroll) */}
        <View className="mb-6">
          <Text className="text-sm font-bold text-gray-400 mb-2">カテゴリ選択</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
            className="flex-row"
          >
            {Object.entries(CATEGORY_LABELS).map(([idStr, label]) => {
              const id = Number(idStr);
              const isActive = filters[id];
              return (
                <Button
                  key={id}
                  title={label}
                  variant={isActive ? "primary" : "outline"}
                  onPress={() => toggleFilter(id)}
                  className={`rounded-full px-4 py-2 ${isActive ? 'bg-gray-800 border-gray-800' : 'bg-white border-gray-300'}`} // Removed fixed height h-9
                  textClassName={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-500'}`}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* Budget Input Area */}
        <View className="bg-white p-5 rounded-xl shadow-sm mb-6 border border-gray-100">
          <Text className="text-sm font-bold text-gray-400 mb-1">本日の残高</Text>
          <View className="flex-row items-center border-b border-gray-200 pb-2 mb-4">
            <Text className="text-3xl font-bold text-gray-900 mr-2">¥</Text>
            <TextInput
              className="flex-1 text-4xl font-bold text-gray-900 h-12 outline-none"
              style={Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}}
              placeholder="0"
              keyboardType="number-pad"
              value={budget}
              onChangeText={setBudget}
              placeholderTextColor="#E5E7EB"
            />
          </View>
          
          <Button 
            title={currentList.length > 0 ? "再計算 (現在の選択を維持)" : "組み合わせを提案"} 
            onPress={() => handleRecommend(false)}
            disabled={!budget}
            className={!budget ? 'opacity-50' : ''}
          />
        </View>

        {/* Dynamic List Area */}
        <View className="mb-8">
           {/* Header: Totals */}
           <View className="flex-row justify-between items-end mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
             <View>
                 <Text className="text-xs text-gray-400 font-bold mb-1">現在の合計 (確定分)</Text>
                 <Text className="text-2xl font-bold text-gray-900">¥{lockedTotal}</Text>
             </View>
             
             <View className="items-end">
                 <Text className="text-xs text-gray-400 font-bold mb-1">おすすめ合計</Text>
                 <Text className={`text-xl font-bold ${totalPrice === (parseInt(budget, 10) || 0) ? 'text-green-600' : 'text-blue-600'}`}>
                    ¥{totalPrice}
                 </Text>
             </View>
           </View>

          {currentList.length === 0 && !loading ? (
            <View className="bg-gray-100 p-10 rounded-xl items-center justify-center border-2 border-dashed border-gray-200">
              <Text className="text-gray-400 text-center">
                金額を入力して{'\n'}スタートしてください
              </Text>
            </View>
          ) : loading ? (
            <View className="items-center py-10">
              <Text className="text-gray-400">計算中...</Text>
            </View>
          ) : (
            <View className="pb-20">
              {/* Section A: Selected Items */}
               <View className="mb-8">
                  <Text className="text-lg font-bold text-gray-800 mb-6 px-1">🛒 買うものリスト</Text>
                  <View>
                      {currentList.filter(item => lockedIds.has(item.id)).map(item => {
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
                              friction={2}
                              rightThreshold={40}
                            >
                              <View 
                                 className="flex-row items-center p-4 rounded-xl border bg-white border-blue-100 shadow-sm h-24 w-[92%] self-center"
                               >
                                  <View className="flex-1">
                                    <Text className="font-bold text-lg text-blue-900" numberOfLines={1}>{item.name}</Text>
                                    <View className="flex-row items-end gap-2">
                                        <Text className="text-gray-500 font-bold">¥{item.price}</Text>
                                        {item.is_temporary && <Text className="text-xs text-purple-600 font-bold">限定</Text>}
                                    </View>
                                  </View>
                                  
                                  <View className="items-end justify-center">
                                      <View className="flex-row items-center bg-gray-100 rounded-lg p-1">
                                          <Button title="-" variant="ghost" onPress={() => updateQuantity(item.id, -1)} className="w-8 h-8 p-0" textClassName="text-lg text-gray-600" />
                                          <Text className="font-bold text-gray-800 w-8 text-center">{qty}</Text>
                                          <Button title="+" variant="ghost" onPress={() => updateQuantity(item.id, 1)} className="w-8 h-8 p-0" textClassName="text-lg text-gray-600" />
                                      </View>
                                  </View>
                               </View>
                            </Swipeable>
                          </View>
                        );
                    })}
                    {currentList.filter(item => lockedIds.has(item.id)).length === 0 && (
                        <View className="p-6 border-2 border-dashed border-gray-200 rounded-xl items-center">
                            <Text className="text-gray-400">リストは空です</Text>
                        </View>
                    )}
                  </View>
               </View>

              {/* Section B: Suggested Items */}
              <View>
                  <Text className="text-lg font-bold text-gray-500 mb-4 px-1">💡 候補・おすすめ</Text>
                  <View>
                    {currentList.filter(item => !lockedIds.has(item.id)).map(item => {
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
                               friction={2}
                               rightThreshold={40}
                            >
                                <View 
                                  className="flex-row items-center p-4 rounded-xl border border-gray-200 bg-gray-50/50 shadow-sm h-24 w-[92%] self-center"
                                >
                                  <View className="flex-1">
                                    <Text className="font-bold text-lg text-gray-700" numberOfLines={1}>{item.name}</Text>
                                    <View className="flex-row items-end gap-2">
                                        <Text className="text-gray-500 font-bold">¥{item.price}</Text>
                                        {item.is_recommended && (
                                          <View className="bg-amber-100 px-1.5 py-0.5 rounded">
                                            <Text className="text-[10px] text-amber-700 font-bold">おすすめ</Text>
                                          </View>
                                        )}
                                    </View>
                                  </View>
                                  
                                  <View className="items-end gap-2">
                                      <Button
                                        title="追加"
                                        variant="outline"
                                        onPress={() => toggleItemLock(item.id)}
                                        className="border-gray-300 bg-white px-6 h-11"
                                        textClassName="text-gray-700 font-bold"
                                        icon={<Plus size={18} color="#374151" />}
                                      />
                                  </View>
                               </View>
                            </Swipeable>
                          </View>
                        );
                    })}
                    {currentList.filter(item => !lockedIds.has(item.id)).length === 0 && (
                        <View className="p-4 items-center">
                            <Text className="text-gray-400 text-xs">提案はありません</Text>
                        </View>
                    )}
                  </View>
              </View>
               
              {/* Action: Refill Gap */}
              <View className="mt-8 pt-6 border-t border-gray-200">
                 <Button 
                   title="空き枠を再検索 (ガチャ)"
                   variant="secondary"
                   onPress={() => handleRecommend(true)}
                 />
                 <Text className="text-xs text-center text-gray-400 mt-2">
                   確定（青色）以外の商品を入れ替えます
                 </Text>
              </View>
            </View>
          )}
        </View>

        {/* Game Link */}
        <View className="mt-8 items-center border-t border-gray-200 pt-8 gap-4">
           <Link href="/game_modal" asChild>
             <Button title="仕分けゲームでポイントGET (?)" variant="outline" className="w-full bg-yellow-50 border-yellow-200" textClassName="text-yellow-700"/>
           </Link>


        </View>
      </ScrollView>

      {/* Barcode Scanner Modal Removed - Now uses route /scanner */}
    </SafeAreaView>
  );
}
