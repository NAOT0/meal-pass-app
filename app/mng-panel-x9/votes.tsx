import { View, Text, ScrollView, SafeAreaView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { Database } from '../../src/types/schema';
import { useRouter } from 'expo-router';
import { AdminGuard } from '../../src/components/AdminGuard';

type Product = Database['public']['Tables']['products']['Row'];
type Vote = Database['public']['Tables']['classification_votes']['Row'];

const CATEGORY_LABELS: Record<number, string> = {
  1: '弁当・丼',
  8: 'おにぎり',
  9: 'パン',
  7: '麺類',
  6: '惣菜',
  2: '飲料',
  3: 'お菓子・デザート',
  5: 'その他',
};

const GAME_CATEGORIES = [
  { id: 1, label: '弁当・丼' },
  { id: 8, label: 'おにぎり' },
  { id: 9, label: 'パン' },
  { id: 7, label: '麺類' },
  { id: 6, label: '惣菜' },
  { id: 2, label: '飲料' },
  { id: 3, label: 'お菓子・デザート' },
  { id: 5, label: 'その他' },
];

interface ProductWithVotes extends Product {
    votes: { [categoryId: number]: number };
    totalVotes: number;
    selectedCategoryId: number; 
}

export default function VoteApprovalScreen() {
    return (
        <AdminGuard>
            <VoteApprovalContent />
        </AdminGuard>
    );
}

function VoteApprovalContent() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<ProductWithVotes[]>([]);
    const router = useRouter();

    useEffect(() => {
        fetchVotes();
    }, []);

    const fetchVotes = async () => {
        setLoading(true);
        try {
            const { data: products, error: pError } = await supabase
                .from('products')
                .select('*')
                .eq('is_verified', false) as { data: Product[] | null, error: any };
            
            if (pError) throw pError;
            if (!products) return;

            const { data: votes, error: vError } = await supabase
                .from('classification_votes')
                .select('*') as { data: Vote[] | null, error: any };
            
            if (vError) throw vError;

            const productMap = new Map<string, ProductWithVotes>();
            products.forEach(p => {
                productMap.set(p.id, { ...p, votes: {}, totalVotes: 0, selectedCategoryId: 1 });
            });

            votes?.forEach(v => {
                const item = productMap.get(v.product_id);
                if (item && v.voted_category_id) {
                    item.votes[v.voted_category_id] = (item.votes[v.voted_category_id] || 0) + 1;
                    item.totalVotes += 1;
                }
            });

            const filtered = Array.from(productMap.values())
                .filter(item => item.totalVotes > 0)
                .map(item => {
                    const topCategory = Object.entries(item.votes).sort((a,b) => b[1] - a[1])[0]?.[0];
                    return { ...item, selectedCategoryId: topCategory ? Number(topCategory) : 1 };
                })
                .sort((a, b) => b.totalVotes - a.totalVotes);

            setItems(filtered);
        } catch (err: any) {
            console.error(err);
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCategory = (productId: string, catId: number) => {
        setItems(prev => prev.map(item => 
            item.id === productId ? { ...item, selectedCategoryId: catId } : item
        ));
    };

    const approveItem = async (productId: string, categoryId: number) => {
        try {
            const { error: pError } = await supabase
                .from('products')
                .update({ 
                    category_id: categoryId,
                    is_verified: true 
                } as any)
                .eq('id', productId);

            if (pError) throw pError;

            await supabase
                .from('classification_votes')
                .delete()
                .eq('product_id', productId);

            setItems(prev => prev.filter(item => item.id !== productId));
            Alert.alert('成功', '承認が完了しました');
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    const discardVotes = async (productId: string) => {
        try {
            await supabase
                .from('classification_votes')
                .delete()
                .eq('product_id', productId);
            
            setItems(prev => prev.filter(item => item.id !== productId));
            Alert.alert('破棄', '投票データを削除しました');
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="px-4 py-3 bg-white shadow-sm flex-row items-center justify-between border-b border-gray-100">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
                        <Text className="text-blue-600 font-bold text-lg">←</Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-gray-800">投票内容の承認</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => supabase.auth.signOut()}
                  className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100"
                >
                    <Text className="text-gray-400 font-bold text-sm">ログアウト</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
                {loading ? (
                    <View className="mt-20 items-center">
                        <ActivityIndicator color="#2563EB" />
                        <Text className="mt-4 text-gray-500 text-sm">集計中...</Text>
                    </View>
                ) : items.length === 0 ? (
                    <View className="items-center mt-20 p-8">
                        <View className="bg-gray-100 rounded-full p-6 mb-4">
                            <Text className="text-4xl">📋</Text>
                        </View>
                        <Text className="text-gray-400 text-center text-base">現在、投票された未承認の商品はありません</Text>
                    </View>
                ) : (
                    <View>
                        <Text className="text-gray-500 text-xs mb-4 font-bold uppercase tracking-wider">
                            全 {items.length} 件の投票された商品
                        </Text>
                        {items.map(item => (
                            <View key={item.id} className="bg-white p-5 rounded-2xl shadow-sm mb-4 border border-gray-100 overflow-hidden">
                                <View className="mb-4">
                                    <View className="flex-row justify-between items-start">
                                        <View className="flex-1">
                                            <Text className="font-bold text-lg text-gray-800 leading-tight mb-1">{item.name}</Text>
                                            <Text className="text-gray-400 text-sm font-bold">¥{item.price}</Text>
                                        </View>
                                    </View>
                                </View>
                                
                                <View className="bg-blue-50/20 rounded-xl mb-4 border border-blue-50 overflow-hidden">
                                    <View className="flex-row">
                                        {/* Left: Vote Distribution */}
                                        <View className="w-1/3 p-4 border-r border-blue-50">
                                            <Text className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-3">ユーザー投票</Text>
                                            <View className="gap-2">
                                                {Object.entries(item.votes).map(([catId, count]) => (
                                                    <View 
                                                        key={catId} 
                                                        className="bg-white border border-blue-100 px-2 py-1 rounded-lg flex-row items-center justify-between"
                                                    >
                                                        <Text className="text-gray-700 font-bold text-[10px]" numberOfLines={1}>
                                                            {CATEGORY_LABELS[Number(catId)] || `?`}
                                                        </Text>
                                                        <View className="bg-blue-500 px-1.5 py-0.5 rounded-full ml-1">
                                                            <Text className="text-white text-[8px] font-black">{count}</Text>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>

                                        {/* Right: Manual Category Selector */}
                                        <View className="flex-1 p-4">
                                            <Text className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mb-3">管理者が選択</Text>
                                            <View className="flex-row flex-wrap gap-1.5">
                                                {GAME_CATEGORIES.map((cat) => (
                                                    <TouchableOpacity
                                                        key={cat.id}
                                                        onPress={() => handleSelectCategory(item.id, cat.id)}
                                                        className={`px-3 py-2 rounded-lg border ${item.selectedCategoryId === cat.id ? 'bg-blue-600 border-blue-600 shadow-sm' : 'bg-white border-gray-100'}`}
                                                    >
                                                        <Text className={`text-[10px] font-bold ${item.selectedCategoryId === cat.id ? 'text-white' : 'text-gray-500'}`}>
                                                            {cat.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                <View className="flex-row justify-end pt-2 gap-3">
                                    <Button 
                                        title="承認する" 
                                        onPress={() => approveItem(item.id, item.selectedCategoryId)} 
                                        className="flex-1 py-3 bg-green-600 h-14" 
                                        textClassName="text-white text-base font-black"
                                    />
                                    <Button 
                                        title="破棄" 
                                        variant="outline" 
                                        onPress={() => discardVotes(item.id)} 
                                        className="py-3 px-8 border-red-100 h-14" 
                                        textClassName="text-red-400 text-sm font-bold"
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
