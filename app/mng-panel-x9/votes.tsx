import { View, Text, ScrollView, SafeAreaView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { Database } from '../../src/types/schema';
import { useRouter } from 'expo-router';
import { AdminGuard } from '../../src/components/AdminGuard';
import { Check, Trash2, Zap, ArrowLeft, LogOut, Package, ChevronRight } from 'lucide-react-native';

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
    consensusRate: number;
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
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [items, setItems] = useState<ProductWithVotes[]>([]);
    const router = useRouter();

    useEffect(() => {
        fetchVotes();
    }, []);

    const fetchVotes = async () => {
        setLoading(true);
        try {
            // 1. Fetch all votes first
            const { data: votes, error: vError } = await supabase
                .from('classification_votes')
                .select('*') as { data: Vote[] | null, error: any };
            
            if (vError) throw vError;
            if (!votes || votes.length === 0) {
                setItems([]);
                setLoading(false);
                return;
            }

            // 2. Get unique product IDs from votes
            const votedProductIds = [...new Set(votes.map(v => v.product_id))];

            // 3. Fetch ONLY those products (ignoring verified status for visibility)
            const { data: products, error: pError } = await (supabase
                .from('products') as any)
                .select('*')
                .in('id', votedProductIds);
            
            if (pError) throw pError;
            if (!products) return;

            const productMap = new Map<string, ProductWithVotes>();
            (products as Product[]).forEach((p: Product) => {
                productMap.set(p.id, { ...p, votes: {}, totalVotes: 0, selectedCategoryId: 1, consensusRate: 0 });
            });

            votes.forEach((v: Vote) => {
                const item = productMap.get(v.product_id);
                if (item && v.voted_category_id) {
                    item.votes[v.voted_category_id] = (item.votes[v.voted_category_id] || 0) + 1;
                    item.totalVotes += 1;
                }
            });

            const filtered = Array.from(productMap.values())
                .filter(item => item.totalVotes > 0)
                .map(item => {
                    const sortedVotes = Object.entries(item.votes).sort((a,b) => b[1] - a[1]);
                    const topCategory = sortedVotes[0]?.[0];
                    const topCount = sortedVotes[0]?.[1] || 0;
                    const rate = item.totalVotes > 0 ? (topCount / item.totalVotes) * 100 : 0;
                    
                    return { 
                        ...item, 
                        selectedCategoryId: topCategory ? Number(topCategory) : 1,
                        consensusRate: Math.round(rate)
                    };
                })
                .sort((a, b) => b.totalVotes - a.totalVotes);

            setItems(filtered);
        } catch (err: any) {
            console.error(err);
            Alert.alert('エラー', err.message);
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
        setIsActionLoading(true);
        try {
            // 1. Update product category and set verified = true
            const { error: pError } = await (supabase
                .from('products') as any)
                .update({ 
                    category_id: categoryId,
                    is_verified: true 
                })
                .eq('id', productId);

            if (pError) throw pError;

            // 2. Delete all related votes
            await (supabase
                .from('classification_votes') as any)
                .delete()
                .eq('product_id', productId);

            // 3. Remove from UI
            setItems(prev => prev.filter(item => item.id !== productId));
            Alert.alert('承認完了', 'カテゴリを更新し、投票データを削除しました。');
        } catch (err: any) {
            Alert.alert('エラー', err.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const autoApproveItems = async () => {
        const candidates = items.filter(item => item.totalVotes >= 3 && item.consensusRate >= 70);
        if (candidates.length === 0) {
            Alert.alert('通知', '一括承認の条件（3票以上かつ一致率70%以上）を満たす商品はありません');
            return;
        }

        Alert.alert(
            '一括承認',
            `${candidates.length}件の商品を自動承認しますか？`,
            [
                { text: 'キャンセル', style: 'cancel' },
                { 
                    text: '実行', 
                    onPress: async () => {
                        setIsActionLoading(true);
                        try {
                            for (const item of candidates) {
                                await (supabase.from('products') as any).update({ 
                                    category_id: item.selectedCategoryId, 
                                    is_verified: true 
                                }).eq('id', item.id);
                                
                                await (supabase.from('classification_votes') as any).delete().eq('product_id', item.id);
                            }
                            fetchVotes();
                            Alert.alert('成功', '一括承認が完了しました');
                        } catch (e) {
                            Alert.alert('エラー', '一部の処理に失敗しました');
                        } finally {
                            setIsActionLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    const discardVotes = async (productId: string) => {
        try {
            await (supabase
                .from('classification_votes') as any)
                .delete()
                .eq('product_id', productId);
            
            setItems(prev => prev.filter(item => item.id !== productId));
        } catch (err: any) {
            Alert.alert('エラー', err.message);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            {/* Header */}
            <View className="px-6 py-4 bg-white shadow-sm flex-row items-center justify-between border-b border-slate-100">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
                        <ArrowLeft size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <Text className="text-xl font-black text-slate-800">ユーザー投票の承認</Text>
                </View>
                <TouchableOpacity onPress={autoApproveItems} disabled={isActionLoading}>
                    <Zap size={24} color={isActionLoading ? "#CBD5E1" : "#EAB308"} fill={isActionLoading ? "none" : "#EAB308"} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
                {loading ? (
                    <View className="mt-20 items-center">
                        <ActivityIndicator color="#2563EB" size="large" />
                        <Text className="mt-4 text-slate-500 font-bold">集計中...</Text>
                    </View>
                ) : items.length === 0 ? (
                    <View className="items-center mt-20 p-8">
                        <View className="bg-slate-100 rounded-full p-8 mb-6">
                            <Package size={64} color="#94A3B8" />
                        </View>
                        <Text className="text-slate-400 text-center text-lg font-bold">現在、承認待ちの投票はありません</Text>
                    </View>
                ) : (
                    <View>
                        <TouchableOpacity 
                            onPress={autoApproveItems}
                            className="bg-yellow-50 border border-yellow-100 p-4 rounded-2xl mb-6 flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center">
                                <Zap size={20} color="#CA8A04" />
                                <Text className="ml-2 text-yellow-800 font-bold">一括オート認証（条件あり）</Text>
                            </View>
                            <ChevronRight size={16} color="#CA8A04" />
                        </TouchableOpacity>

                        {items.map(item => (
                            <View key={item.id} className="bg-white p-6 rounded-[32px] shadow-sm mb-6 border border-slate-100">
                                <View className="flex-row justify-between items-start mb-4">
                                    <View className="flex-1">
                                        <Text className="font-bold text-xl text-slate-900 leading-tight mb-1">{item.name}</Text>
                                        <View className="flex-row items-center">
                                            <Text className="text-slate-400 font-bold">¥{item.price}</Text>
                                            {item.is_verified && (
                                                <View className="ml-2 bg-green-50 px-2 py-0.5 rounded-md">
                                                    <Text className="text-green-600 text-[8px] font-bold">認証済み(インポート)</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View className="bg-pink-50 px-3 py-1 rounded-full items-center">
                                        <Text className="text-pink-600 text-[10px] font-black uppercase">{item.totalVotes} VOTES</Text>
                                        <Text className="text-pink-400 text-[8px] font-bold">一致率 {item.consensusRate}%</Text>
                                    </View>
                                </View>
                                
                                <View className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
                                    <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">認証するカテゴリを選択:</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {GAME_CATEGORIES.map((cat) => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                onPress={() => handleSelectCategory(item.id, cat.id)}
                                                className={`px-4 py-2 rounded-xl border ${item.selectedCategoryId === cat.id ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200' : 'bg-white border-slate-200'}`}
                                            >
                                                <Text className={`text-xs font-bold ${item.selectedCategoryId === cat.id ? 'text-white' : 'text-slate-500'}`}>
                                                    {cat.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View className="flex-row gap-3">
                                    <TouchableOpacity 
                                        onPress={() => approveItem(item.id, item.selectedCategoryId)}
                                        className="flex-1 bg-slate-900 h-14 rounded-2xl items-center justify-center flex-row shadow-lg shadow-slate-200"
                                    >
                                        <Check size={20} color="white" />
                                        <Text className="text-white font-black ml-2">認証して反映</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        onPress={() => discardVotes(item.id)}
                                        className="w-14 items-center justify-center bg-white border border-slate-200 rounded-2xl"
                                    >
                                        <Trash2 size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
