import { View, Text, FlatList, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal, Switch, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { ArrowLeft, Search, Package, ChevronRight, X, Save, Check, Star, Plus } from 'lucide-react-native';

const CATEGORIES = [
    { id: 1, name: '弁当・丼', slug: 'bento' },
    { id: 2, name: '飲料', slug: 'drink' },
    { id: 3, name: 'お菓子・デザート', slug: 'snack' },
    { id: 6, name: '惣菜', slug: 'deli' },
    { id: 7, name: '麺類', slug: 'noodle' },
    { id: 8, name: 'おにぎり', slug: 'onigiri' },
    { id: 9, name: 'パン', slug: 'bread' },
    { id: 5, name: 'その他', slug: 'unknown' },
];

export default function ProductListScreen() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [total, setTotal] = useState(0);
    const [showOnlyRecommended, setShowOnlyRecommended] = useState(false);

    // Modal States
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [isAddModalVisible, setAddModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [newProduct, setNewProduct] = useState<any>({ name: '', price: '', category_id: 8, is_recommended: false, jan: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, showOnlyRecommended]);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('products')
                .select('*, product_barcodes(jan_code)', { count: 'exact' })
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(50);

            if (showOnlyRecommended) {
                query = query.eq('is_recommended', true);
            }

            if (searchQuery) {
                const terms = searchQuery.split(/[\s,]+/).filter(t => t.length > 0);
                const janTerms = terms.filter(t => /^\d+$/.test(t));
                const nameTerms = terms.filter(t => !/^\d+$/.test(t));

                if (janTerms.length > 0) {
                    // Bulk JAN search
                    let barcodeQuery = supabase.from('product_barcodes').select('product_id');
                    if (janTerms.length === 1) {
                        barcodeQuery = barcodeQuery.ilike('jan_code', `${janTerms[0]}%`);
                    } else {
                        const filters = janTerms.map(j => `jan_code.ilike.${j}%`).join(',');
                        barcodeQuery = barcodeQuery.or(filters);
                    }
                    
                    const { data: barcodeData } = await (barcodeQuery as any).limit(100);
                    if (barcodeData && barcodeData.length > 0) {
                        const productIds = (barcodeData as any[]).map(b => b.product_id);
                        query = query.in('id', productIds);
                    } else if (nameTerms.length === 0) {
                        // If only JANs searched and none found, return empty
                        setProducts([]);
                        setTotal(0);
                        setIsLoading(false);
                        return;
                    }
                }

                if (nameTerms.length > 0) {
                    nameTerms.forEach(term => {
                        query = query.ilike('name', `%${term}%`);
                    });
                }
            }

            const { data, count, error } = await query;
            if (!error) {
                setProducts(data || []);
                setTotal(count || 0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleRecommendation = async (id: string, currentStatus: boolean) => {
        const { error } = await (supabase
            .from('products') as any)
            .update({ is_recommended: !currentStatus })
            .eq('id', id);
        
        if (!error) {
            setProducts(products.map(p => p.id === id ? { ...p, is_recommended: !currentStatus } : p));
        } else {
            Alert.alert('エラー', '更新に失敗しました');
        }
    };

    const handleEditProduct = (product: any) => {
        setEditingProduct({ 
            ...product, 
            unique_jan: product.product_barcodes?.[0]?.jan_code 
        });
        setEditModalVisible(true);
    };

    const handleSaveProduct = async () => {
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            const { error } = await (supabase
                .from('products') as any)
                .update({
                    name: editingProduct.name,
                    price: parseInt(editingProduct.price) || 0,
                    category_id: editingProduct.category_id,
                    is_recommended: editingProduct.is_recommended
                })
                .eq('id', editingProduct.id);

            if (error) throw error;

            setProducts(products.map(p => p.id === editingProduct.id ? {
                ...p,
                name: editingProduct.name,
                price: parseInt(editingProduct.price) || 0,
                category_id: editingProduct.category_id,
                is_recommended: editingProduct.is_recommended
            } : p));

            setEditModalVisible(false);
            Alert.alert('成功', '更新しました');
        } catch (e) {
            Alert.alert('エラー', '更新に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddProduct = async () => {
        if (!newProduct.name || !newProduct.price) {
            Alert.alert('エラー', '名前と価格を入力してください');
            return;
        }
        setIsSaving(true);
        try {
            // 1. Insert product
            const { data: prod, error: pErr } = await (supabase
                .from('products') as any)
                .insert({
                    name: newProduct.name,
                    price: parseInt(newProduct.price) || 0,
                    category_id: newProduct.category_id,
                    is_recommended: newProduct.is_recommended,
                    is_active: true,
                    is_verified: true
                })
                .select()
                .single();

            if (pErr) throw pErr;

            // 2. Insert barcode if exists
            if (newProduct.jan) {
                const { error: bErr } = await (supabase
                    .from('product_barcodes') as any)
                    .insert({
                        product_id: (prod as any).id,
                        jan_code: newProduct.jan
                    });
                if (bErr) console.warn('Barcode insert failed:', bErr.message);
            }

            Alert.alert('成功', '商品を追加しました');
            setAddModalVisible(false);
            setNewProduct({ name: '', price: '', category_id: 8, is_recommended: false, jan: '' });
            fetchProducts();
        } catch (e) {
            console.error(e);
            Alert.alert('エラー', '追加に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const getCategoryName = (id: number) => CATEGORIES.find(c => c.id === id)?.name || '未分類';

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            {/* Header */}
            <View className="bg-white p-6 border-b border-gray-100">
                <View className="flex-row items-center justify-between mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="bg-gray-50 p-3 rounded-2xl">
                        <ArrowLeft size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <Text className="text-xl font-black text-[#1E293B]">商品管理</Text>
                    <TouchableOpacity 
                        onPress={() => setAddModalVisible(true)}
                        className="bg-blue-600 p-3 rounded-2xl flex-row items-center"
                    >
                        <Plus size={20} color="white" />
                        <Text className="text-white font-bold ml-1">追加</Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-row gap-3">
                    <View className="bg-gray-50 flex-1 flex-row items-center px-4 py-4 rounded-2xl border border-gray-100">
                        <Search size={20} color="#94A3B8" />
                        <TextInput 
                            placeholder="名前またはJANコード（複数可）"
                            className="flex-1 ml-3 text-[#1E293B] font-medium"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                        />
                    </View>
                    <TouchableOpacity 
                        onPress={() => setShowOnlyRecommended(!showOnlyRecommended)}
                        className={`w-14 items-center justify-center rounded-2xl border ${
                            showOnlyRecommended ? 'bg-amber-100 border-amber-200' : 'bg-gray-50 border-gray-100'
                        }`}
                    >
                        <Star size={24} color={showOnlyRecommended ? '#D97706' : '#94A3B8'} fill={showOnlyRecommended ? '#D97706' : 'none'} />
                    </TouchableOpacity>
                </View>
            </View>

            {isLoading && !products.length ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="#2563EB" size="large" />
                </View>
            ) : (
                <FlatList 
                    data={products}
                    keyExtractor={(item) => item.id}
                    className="px-6"
                    contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
                    ListHeaderComponent={
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-slate-400 font-bold text-xs tracking-widest uppercase">
                                {total > 50 ? `全${total.toLocaleString()}件中の上位50件` : `${total}件の商品`}
                            </Text>
                            {showOnlyRecommended && (
                                <View className="bg-amber-100 px-3 py-1 rounded-full">
                                    <Text className="text-amber-700 text-[10px] font-bold">おすすめ中のみ表示</Text>
                                </View>
                            )}
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            onPress={() => handleEditProduct(item)}
                            className="bg-white p-5 rounded-3xl mb-4 border border-gray-100 shadow-sm flex-row items-center"
                        >
                            <TouchableOpacity 
                                onPress={() => toggleRecommendation(item.id, item.is_recommended)}
                                className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${item.is_recommended ? 'bg-amber-50' : 'bg-slate-50'}`}
                            >
                                <Star 
                                    size={24} 
                                    color={item.is_recommended ? '#D97706' : '#CBD5E1'} 
                                    fill={item.is_recommended ? '#D97706' : 'none'} 
                                />
                            </TouchableOpacity>
                            <View className="flex-1">
                                <Text className="text-[#1E293B] font-bold text-lg mb-0.5" numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <View className="flex-row items-center flex-wrap">
                                    <Text className="text-gray-400 text-xs font-medium mr-2">
                                        {item.product_barcodes?.[0]?.jan_code || 'JANなし'}
                                    </Text>
                                    <View className="bg-gray-100 px-1.5 py-0.5 rounded mr-2">
                                        <Text className="text-gray-500 text-[10px] font-bold">
                                            {getCategoryName(item.category_id)}
                                        </Text>
                                    </View>
                                    <Text className="text-blue-600 text-xs font-bold">
                                        ¥{item.price}
                                    </Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View className="items-center py-20">
                            <Package size={48} color="#E2E8F0" />
                            <Text className="text-gray-400 font-bold mt-4">商品が見つかりません</Text>
                        </View>
                    }
                />
            )}

            {/* Product Forms (Edit / Add) */}
            <ProductModal 
                visible={isEditModalVisible} 
                onClose={() => setEditModalVisible(false)}
                data={editingProduct}
                setData={setEditingProduct}
                onSave={handleSaveProduct}
                isSaving={isSaving}
                title="商品の編集"
            />
            
            <ProductModal 
                visible={isAddModalVisible} 
                onClose={() => setAddModalVisible(false)}
                data={newProduct}
                setData={setNewProduct}
                onSave={handleAddProduct}
                isSaving={isSaving}
                title="商品の新規追加"
                isNew={true}
            />

        </SafeAreaView>
    );
}

function ProductModal({ visible, onClose, data, setData, onSave, isSaving, title, isNew = false }: any) {
    if (!data) return null;
    
    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 bg-black/50 justify-end"
            >
                <View className="bg-white rounded-t-[32px] p-6 h-[85%]">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-black text-[#1E293B]">{title}</Text>
                        <TouchableOpacity onPress={onClose} className="bg-gray-100 p-2 rounded-full">
                            <X size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1">
                        <View className="gap-6">
                            {/* JAN Code */}
                            <View>
                                <Text className="text-sm font-bold text-gray-700 mb-2">JANコード</Text>
                                <TextInput 
                                    value={isNew ? data.jan : data.unique_jan}
                                    onChangeText={(text) => setData({...data, [isNew ? 'jan' : 'unique_jan']: text})}
                                    className={`bg-white border rounded-2xl p-4 text-base font-bold text-gray-900 ${isNew ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}
                                    placeholder="490..."
                                    editable={isNew}
                                />
                                {!isNew && <Text className="text-gray-400 text-[10px] mt-1 ml-1">※JANコードの変更は一括インポートをご利用ください</Text>}
                            </View>

                            {/* Name */}
                            <View>
                                <Text className="text-sm font-bold text-gray-700 mb-2">商品名</Text>
                                <TextInput 
                                    value={data.name}
                                    onChangeText={(text) => setData({...data, name: text})}
                                    className="bg-white border border-gray-200 rounded-2xl p-4 text-base font-bold text-gray-900"
                                    placeholder="商品名を入力"
                                />
                            </View>

                            {/* Price */}
                            <View>
                                <Text className="text-sm font-bold text-gray-700 mb-2">価格 (¥)</Text>
                                <TextInput 
                                    value={String(data.price)}
                                    onChangeText={(text) => setData({...data, price: text})}
                                    className="bg-white border border-gray-200 rounded-2xl p-4 text-base font-bold text-gray-900"
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                            </View>

                            {/* Category Selector */}
                            <View>
                                <Text className="text-sm font-bold text-gray-700 mb-2">カテゴリ</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {CATEGORIES.map(cat => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            onPress={() => setData({...data, category_id: cat.id})}
                                            className={`px-4 py-2 rounded-full border ${
                                                data.category_id === cat.id 
                                                ? 'bg-blue-600 border-blue-600' 
                                                : 'bg-white border-gray-200'
                                            }`}
                                        >
                                            <Text className={`font-bold text-sm ${
                                                data.category_id === cat.id ? 'text-white' : 'text-gray-600'
                                            }`}>
                                                {cat.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Recommended Toggle */}
                            <View className="bg-amber-50 p-4 rounded-2xl flex-row justify-between items-center border border-amber-100">
                                <View>
                                    <Text className="text-amber-900 font-bold text-lg">おすすめ商品に設定</Text>
                                    <Text className="text-amber-700/60 text-xs">トップ画面で優先的に提案されます</Text>
                                </View>
                                <Switch 
                                    value={data.is_recommended}
                                    onValueChange={(val) => setData({...data, is_recommended: val})}
                                    trackColor={{ false: "#D1D5DB", true: "#D97706" }}
                                    thumbColor={data.is_recommended ? "#FFF" : "#F3F4F6"}
                                />
                            </View>
                            <View className="h-10" />
                        </View>
                    </ScrollView>

                    <TouchableOpacity 
                        onPress={onSave}
                        disabled={isSaving}
                        className={`p-5 rounded-2xl items-center shadow-lg flex-row justify-center ${
                            isSaving ? 'bg-gray-400' : 'bg-blue-600 shadow-blue-300'
                        }`}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Save size={20} color="white" className="mr-2" />
                                <Text className="text-white font-black text-lg">{isNew ? '商品を追加する' : '変更を保存する'}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
