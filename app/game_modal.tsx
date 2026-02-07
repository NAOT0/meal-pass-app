import { View, Text, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { Database } from '../src/types/schema';
import { Button } from '../src/components/Button';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
type Product = Database['public']['Tables']['products']['Row'];

// UI definition for categories (ID -> Label, Color)
const GAME_CATEGORIES = [
  { id: 1, label: '弁当・丼', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 8, label: 'おにぎり', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: 9, label: 'パン', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 7, label: '麺類', color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 6, label: '惣菜', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 2, label: '飲料', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 3, label: 'お菓子・デザート', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 5, label: 'その他/該当なし', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

export default function GameModal() {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUnverifiedProducts();
  }, []);
  useEffect(() => {
    // Web版かつ、ServiceWorkerが使える環境なら登録する
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('SW registered: ', registration);
          },
          (err) => {
            console.log('SW registration failed: ', err);
          }
        );
      });
    }
  }, []);

  const fetchUnverifiedProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Get products already voted by this user
      const { data: votedData } = await supabase
        .from('classification_votes')
        .select('product_id')
        .eq('session_id', user.id) as { data: { product_id: string }[] | null, error: any };
      
      const votedIds = votedData?.map(v => v.product_id) || [];

      // 2. Get total count of unverified products (excluding voted) to pick a random offset
      let baseQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', false);

      if (votedIds.length > 0) {
        baseQuery = baseQuery.not('id', 'in', `(${votedIds.join(',')})`);
      }

      const { count } = await baseQuery;
      const totalAvailable = count || 0;
      const randomOffset = totalAvailable > 10 
        ? Math.floor(Math.random() * (totalAvailable - 10)) 
        : 0;

      // 3. Fetch a slice starting at a random offset
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_verified', false);

      if (votedIds.length > 0) {
        query = query.not('id', 'in', `(${votedIds.join(',')})`);
      }

      const { data, error } = await query
        .range(randomOffset, randomOffset + 10);
      
      if (data) {
        setProducts(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (categoryId: number) => {
    const product = products[currentIndex];
    if (!product) return;

    // Async Insert
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
       supabase.from('classification_votes').insert({
          product_id: product.id,
          voted_category_id: categoryId, // Correct column name
          session_id: user.id // Correct column name
       } as any).then(({ error }) => {
         if (error) console.error('Vote storage error:', error);
       });
    }

    setCurrentIndex(prev => prev + 1);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-4 text-gray-500">データを読み込んでいます...</Text>
      </View>
    );
  }

  const isFinished = currentIndex >= products.length;
  const currentProduct = products[currentIndex];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="p-4 border-b border-gray-200 flex-row justify-between items-center bg-white shadow-sm z-10">
        <Text className="text-lg font-bold text-gray-800">仕分けゲーム</Text>
        <Button title="閉じる" variant="outline" onPress={() => router.back()} className="py-2 px-4" />
      </View>

      <View className="flex-1 items-center justify-center p-4">
        {!isFinished && currentProduct ? (
            <View className="w-full max-w-sm">
                
                {/* Product Card */}
                <View className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 items-center mb-8">
                    <View className="bg-blue-50 w-24 h-24 rounded-full mb-4 items-center justify-center">
                        <Text className="text-4xl">📦</Text>
                    </View>
                    <Text className="text-2xl font-bold text-gray-800 text-center mb-2 px-2">
                        {currentProduct.name}
                    </Text>
                    <Text className="text-xl text-gray-500 font-bold">
                        ¥{currentProduct.price}
                    </Text>
                </View>

                {/* Question */}
                <Text className="text-center text-gray-500 mb-4 font-bold">
                    どのカテゴリに分類しますか？
                </Text>

                {/* Button Grid */}
                <View className="flex-row flex-wrap justify-between gap-y-3">
                    {GAME_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat.id}
                            onPress={() => handleVote(cat.id)}
                            className={`w-[48%] py-4 rounded-xl border ${cat.color.split(' ')[2]} ${cat.color.split(' ')[0]} shadow-sm active:opacity-70`}
                        >
                            <Text className={`text-center font-bold text-lg ${cat.color.split(' ')[1]}`}>
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

            </View>
        ) : (
            /* Finished View */
            <View className="items-center p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
                <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
                    <Text className="text-4xl">🎉</Text>
                </View>
                <Text className="text-xl font-bold text-gray-800 mb-2">全部完了！</Text>
                <Text className="text-gray-500 mb-8 text-center">
                    ご協力ありがとうございました。{'\n'}データ精度が向上しました！
                </Text>
                <Button title="ホームに戻る" onPress={() => router.back()} className="w-48 py-3" />
            </View>
        )}
      </View>
    </SafeAreaView>
  );
}
