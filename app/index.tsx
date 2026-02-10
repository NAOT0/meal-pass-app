import { View, Text, TextInput, ScrollView, SafeAreaView, Platform, LayoutAnimation, UIManager, TouchableOpacity, StatusBar } from 'react-native';
import { useState, useEffect } from 'react';
import { signInAnonymously } from '../src/lib/auth';
import { Button } from '../src/components/Button';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { fillBudget, CATEGORY_IDS } from '../src/features/recommendation/logic';
import { Database } from '../src/types/schema';
import { Scan, Plus, Minus, Trash2, Utensils, GlassWater, Gamepad2, Dice5, RefreshCcw } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useCartStore } from '../src/store/useCartStore';

type Product = Database['public']['Tables']['products']['Row'];

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
  
  const [totalPrice, setTotalPrice] = useState(0);
  const [lockedTotal, setLockedTotal] = useState(0);

  const [filters, setFilters] = useState<Record<number, boolean>>({
    [CATEGORY_IDS.BENTO]: true,
    [CATEGORY_IDS.ONIGIRI]: true,
    [CATEGORY_IDS.NOODLE]: true,
    [CATEGORY_IDS.DELI]: true,
    [CATEGORY_IDS.SNACK]: true,
    [CATEGORY_IDS.BREAD]: true,
    [CATEGORY_IDS.DRINK]: true,
  });

  const CATEGORY_LABELS: Record<number, string> = {
    [CATEGORY_IDS.BENTO]: '弁当・丼',
    [CATEGORY_IDS.ONIGIRI]: 'おにぎり',
    [CATEGORY_IDS.NOODLE]: '麺類',
    [CATEGORY_IDS.DELI]: '惣菜',
    [CATEGORY_IDS.DRINK]: '飲料',
    [CATEGORY_IDS.SNACK]: 'お菓子',
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

  useEffect(() => {
    let allSum = 0;
    let lockedSum = 0;

    currentList.forEach(item => {
      const qty = quantities[item.id] || 1;
      const subtotal = item.price * qty;
      allSum += subtotal;
      if (lockedIds.has(item.id)) {
        lockedSum += subtotal;
      }
    });

    setTotalPrice(allSum);
    setLockedTotal(lockedSum);
  }, [currentList, quantities, lockedIds]);

  const fetchProducts = async () => {
    console.log('--- DB Fetch Start ---');
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*)')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('is_recommended', { ascending: false })
      .limit(1000); // Standard limit
    
     if (data) {
      const recCount = data.filter(p => (p as any).is_recommended).length;
      console.log(`[Fetch Result] Total: ${data.length}, Recommended: ${recCount}`);
      
      if (recCount > 0) {
          const sample = data.find(p => (p as any).is_recommended);
          console.log('[Sample Recommended Item]', { id: sample.id, name: sample.name, is_rec: (sample as any).is_recommended });
      }

      setProducts(data as any);
      useCartStore.getState().setProducts(data as any);
    } else {
      console.error('Fetch error:', error);
    }
    console.log('--- DB Fetch End ---');
  };

  const handleRecommend = (isRefill = false) => {
    const budgetNum = parseInt(budget, 10);
    console.log('Suggesting with budget:', budgetNum);
    if (isNaN(budgetNum) || budgetNum <= 0) return;

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

      const { list } = fillBudget(products, currentList, locksToUse, effectiveBudget, allowedIds);
      console.log('Suggestion result count:', list.length);
      
      const newQuantities = { ...quantities };
      list.forEach(p => {
        if (!newQuantities[p.id]) newQuantities[p.id] = 1;
      });
      
      const finalListIds = new Set(list.map(p => p.id));
      Object.keys(newQuantities).forEach(id => {
        if (!finalListIds.has(id)) delete newQuantities[id];
      });

      setLoading(false);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      useCartStore.setState({ currentList: list, quantities: newQuantities });
    }, 300);
  };

  const parsedBudget = parseInt(budget, 10) || 0;
  const remaining = Math.max(0, parsedBudget - lockedTotal);

  // Check if there's anything left in the database that could possibly fit the remaining budget and filters
  const canSuggestMore = products.some(p => 
    p.price <= remaining && 
    p.is_active && 
    !lockedIds.has(p.id) &&
    (p.category_id ? filters[p.category_id] : true)
  );

  const hasVisibleSuggestions = currentList.some(item => !lockedIds.has(item.id)) || (canSuggestMore && !loading);

  return (
    <SafeAreaView className="flex-1 bg-warm-beige">
      <StatusBar barStyle="dark-content" />
      
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header (Clean) */}
        <View className="pt-10 px-6 pb-4">
          <Text className="text-xl font-bold text-[#2D332B]">ミールパス計算アプリ</Text>
          <Text className="text-[10px] text-sage-green font-medium opacity-70">ver1.1.0 (Rec)</Text>
        </View>

        {/* Filter Scroll (Top) */}
        <View className="pt-2 pb-6">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
            className="flex-row"
          >
            {Object.entries(CATEGORY_LABELS).map(([idStr, label]) => {
              const id = Number(idStr);
              const isActive = filters[id];
              return (
                <TouchableOpacity
                  key={id}
                  activeOpacity={0.8}
                  onPress={() => toggleFilter(id)}
                  className={`px-6 py-2.5 rounded-full border ${isActive ? 'bg-sage-green border-sage-green' : 'bg-white border-[#E8E6E0]'}`}
                >
                  <Text className={`text-sm font-bold ${isActive ? 'text-white' : 'text-[#4A5547]'}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Budget Card */}
        <View className="px-6">
          <View className="bg-sage-green rounded-xl p-6 shadow-xl shadow-sage-green/10">
            <Text className="text-[13px] font-bold text-white opacity-90 mb-2">本日の残高</Text>
            
            <View className="flex-row items-center mb-6">
              <View className="flex-1 flex-row items-center border-b border-white/20 h-20 mr-4">
                <Text className="text-2xl font-bold text-white mr-2">¥</Text>
                <TextInput
                  className="flex-1 text-5xl font-bold text-white p-0 outline-none h-16"
                  style={Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}}
                  placeholder="500"
                  keyboardType="number-pad"
                  value={budget}
                  onChangeText={setBudget}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
              {/* Scan Button next to Input */}
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/scanner')}
                className="bg-white/20 w-16 h-16 rounded-2xl items-center justify-center border border-white/30"
              >
                <Scan color="white" size={28} />
              </TouchableOpacity>
            </View>
            
            {/* Suggest Button */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => handleRecommend(false)}
              disabled={!budget}
              className={`bg-white rounded-xl py-4 items-center justify-center shadow-sm ${!budget ? 'opacity-50' : ''}`}
            >
              <Text className="text-sage-green font-bold text-lg">組み合わせを提案</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Shopping List Section */}
        <View className="px-6 pt-10">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-sm font-bold text-[#2D332B]">🛒 買うものリスト</Text>
            <Text className="text-sm font-bold text-gray-400">合計 ¥{lockedTotal}</Text>
          </View>
          
          <View className="space-y-3">
            {currentList.filter(item => lockedIds.has(item.id)).map(item => {
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
                      <View className="flex-row items-center gap-4 flex-1">
                        <View className="flex-1">
                          <Text className="font-bold text-[15px]" numberOfLines={1}>{item.name}</Text>
                          <Text className="text-sm text-gray-500 font-medium">¥{item.price}</Text>
                        </View>
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
            })}
            {currentList.filter(item => lockedIds.has(item.id)).length === 0 && !loading && (
              <View className="border-2 border-dashed border-[#E8E6E0] rounded-2xl p-6 items-center">
                <Text className="text-gray-400 text-sm">予算を入力して計算してください</Text>
              </View>
            )}
          </View>
        </View>

        {/* Suggestions Section */}
        {hasVisibleSuggestions && (
          <View className="px-6 pt-10">
            <Text className="text-sm font-bold text-[#2D332B] mb-4">
              💡 あと{remaining}円で買うならこれ！
            </Text>
            
            <View className="space-y-3">
              {currentList.filter(item => !lockedIds.has(item.id)).map(item => {
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
                        <View className="flex-row items-center gap-4 flex-1">
                          <View className="flex-1">
                            <Text className="font-bold text-[15px]" numberOfLines={1}>{item.name}</Text>
                            <Text className="text-sm text-gray-500 font-medium">¥{item.price}</Text>
                          </View>
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

              {/* Empty Suggestion Area with Re-search Button */}
              {currentList.filter(item => !lockedIds.has(item.id)).length === 0 && !loading && canSuggestMore && (
                <TouchableOpacity
                  onPress={() => handleRecommend(false)}
                  activeOpacity={0.7}
                  className="border-2 border-dashed border-sage-green/20 rounded-2xl p-8 items-center justify-center bg-white/40"
                >
                  <RefreshCcw size={20} color="#7D926B" />
                  <Text className="text-sage-green font-bold text-sm mt-2">他のおすすめを探す</Text>
                  <Text className="text-[10px] text-gray-400 mt-1">残り {remaining}円に合う商品を検索します</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Game Button */}
        <View className="px-6 pt-10">
          <Link href="/game_modal" asChild>
            <TouchableOpacity 
              activeOpacity={0.8}
              className="w-full bg-white border-2 border-game-yellow py-4 rounded-lg flex-row items-center justify-center shadow-sm"
            >
              <Gamepad2 size={24} color="#FBBF24" fill="#FBBF24" />
              <Text className="text-[15px] font-bold text-gray-800 ml-2">仕分けゲームでポイントGET (?)</Text>
            </TouchableOpacity>
          </Link>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
