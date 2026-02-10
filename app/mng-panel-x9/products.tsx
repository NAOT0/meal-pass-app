import { View, Text, FlatList, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal, Switch, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { ArrowLeft, Search, Package, ChevronRight, X, Save, Check } from 'lucide-react-native';

// Categories constant
const CATEGORIES = [
    { id: 1, name: '弁当・丼', slug: 'bento' },
    { id: 2, name: '飲料', slug: 'drink' },
    { id: 3, name: 'お菓子', slug: 'snack' },
    { id: 4, name: 'デザート', slug: 'dessert' },
    { id: 5, name: '不明', slug: 'unknown' },
    { id: 6, name: '惣菜', slug: 'deli' },
    { id: 7, name: '麺類・汁物', slug: 'noodle' },
    { id: 8, name: 'おにぎり', slug: 'onigiri' },
];

export default function ProductListScreen() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [total, setTotal] = useState(0);

    // Edit Modal State
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchProducts();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('products')
                .select('*, product_barcodes(jan_code)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .limit(50);

            if (searchQuery) {
                // Determine if search query is likely a JAN code (all digits)
                const isJan = /^\d+$/.test(searchQuery);

                if (isJan) {
                    // 1. Search Barcodes table first
                    const { data: barcodeData } = await supabase
                        .from('product_barcodes')
                        .select('product_id')
                        .ilike('jan_code', `${searchQuery}%`)
                        .limit(50);
                    
                    if (barcodeData && barcodeData.length > 0) {
                        const productIds = barcodeData.map(b => b.product_id);
                        query = query.in('id', productIds);
                    } else {
                        // No barcode match found, fallback to name search just in case or return empty
                        query = query.ilike('name', `%${searchQuery}%`);
                    }
                } else {
                    // Standard Name Search
                    query = query.ilike('name', `%${searchQuery}%`);
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
            const { error } = await supabase
                .from('products')
                .update({
                    name: editingProduct.name,
                    price: parseInt(editingProduct.price) || 0,
                    category_id: editingProduct.category_id,
                    is_recommended: editingProduct.is_recommended
                })
                .eq('id', editingProduct.id);

            if (error) throw error;

            // Update local list
            setProducts(products.map(p => p.id === editingProduct.id ? {
                ...p,
                name: editingProduct.name,
                price: parseInt(editingProduct.price) || 0,
                category_id: editingProduct.category_id,
                is_recommended: editingProduct.is_recommended
            } : p));

            setEditModalVisible(false);
            Alert.alert('Success', '更新しました');
        } catch (e) {
            Alert.alert('Error', '更新に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const getCategoryName = (id: number) => CATEGORIES.find(c => c.id === id)?.name || 'Unknown';

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            {/* Header */}
            <View className="bg-white p-6 border-b border-gray-100">
                <View className="flex-row items-center justify-between mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="bg-gray-50 p-3 rounded-2xl">
                        <ArrowLeft size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <Text className="text-xl font-black text-[#1E293B]">Products</Text>
                    <View className="w-12" />
                </View>

                <View className="bg-gray-50 flex-row items-center px-4 py-4 rounded-2xl border border-gray-100">
                    <Search size={20} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search by Name or JAN Code..."
                        className="flex-1 ml-3 text-[#1E293B] font-medium"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#94A3B8"
                        keyboardType="default" // RN handles number input fine in default for search usually
                        autoCapitalize="none"
                    />
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
                    className="p-6"
                    contentContainerStyle={{ paddingBottom: 40 }}
                    ListHeaderComponent={
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-400 font-bold text-xs tracking-widest uppercase">
                                {total > 50 ? `Showing top 50 of ${total.toLocaleString()}` : ``}
                            </Text>
                            <View className="bg-blue-100 px-2 py-1 rounded">
                                <Text className="text-blue-700 text-xs font-bold">{total.toLocaleString()} Items</Text>
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            onPress={() => handleEditProduct(item)}
                            className="bg-white p-5 rounded-3xl mb-4 border border-gray-100 shadow-sm flex-row items-center"
                        >
                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${item.is_recommended ? 'bg-amber-100' : 'bg-blue-50'}`}>
                                <Package size={24} color={item.is_recommended ? '#D97706' : '#2563EB'} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[#1E293B] font-bold text-lg mb-0.5" numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <View className="flex-row items-center flex-wrap">
                                    <Text className="text-gray-400 text-xs font-medium mr-2">
                                        {item.product_barcodes?.[0]?.jan_code || 'No JAN'}
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
                            {item.is_recommended && (
                                <View className="bg-amber-100 p-1 rounded-full mr-2">
                                    <Check size={12} color="#D97706" />
                                </View>
                            )}
                            <ChevronRight size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View className="items-center py-20">
                            <Package size={48} color="#E2E8F0" />
                            <Text className="text-gray-400 font-bold mt-4">No products found</Text>
                        </View>
                    }
                />
            )}

            {/* Edit Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isEditModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 bg-black/50 justify-end"
                >
                    <View className="bg-white rounded-t-[32px] p-6 h-[80%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-black text-[#1E293B]">Edit Product</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)} className="bg-gray-100 p-2 rounded-full">
                                <X size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="flex-1">
                            {editingProduct && (
                                <View className="gap-6">
                                    {/* ID / JAN Info (Read Only) */}
                                    <View className="bg-gray-50 p-4 rounded-2xl">
                                        <Text className="text-xs text-gray-400 font-bold mb-1">JAN CODE</Text>
                                        <Text className="text-gray-900 font-mono font-bold tracking-widest">
                                            {editingProduct.unique_jan || 'N/A'}
                                        </Text>
                                    </View>

                                    {/* Name Input */}
                                    <View>
                                        <Text className="text-sm font-bold text-gray-700 mb-2">Product Name</Text>
                                        <TextInput 
                                            value={editingProduct.name}
                                            onChangeText={(text) => setEditingProduct({...editingProduct, name: text})}
                                            className="bg-white border border-gray-200 rounded-2xl p-4 text-base font-bold text-gray-900"
                                            placeholder="Enter product name"
                                        />
                                    </View>

                                    {/* Price Input */}
                                    <View>
                                        <Text className="text-sm font-bold text-gray-700 mb-2">Price (¥)</Text>
                                        <TextInput 
                                            value={String(editingProduct.price)}
                                            onChangeText={(text) => setEditingProduct({...editingProduct, price: text})}
                                            className="bg-white border border-gray-200 rounded-2xl p-4 text-base font-bold text-gray-900"
                                            keyboardType="numeric"
                                            placeholder="0"
                                        />
                                    </View>

                                    {/* Category Selector (Simple Pills) */}
                                    <View>
                                        <Text className="text-sm font-bold text-gray-700 mb-2">Category</Text>
                                        <View className="flex-row flex-wrap gap-2">
                                            {CATEGORIES.map(cat => (
                                                <TouchableOpacity
                                                    key={cat.id}
                                                    onPress={() => setEditingProduct({...editingProduct, category_id: cat.id})}
                                                    className={`px-4 py-2 rounded-full border ${
                                                        editingProduct.category_id === cat.id 
                                                        ? 'bg-blue-600 border-blue-600' 
                                                        : 'bg-white border-gray-200'
                                                    }`}
                                                >
                                                    <Text className={`font-bold text-sm ${
                                                        editingProduct.category_id === cat.id ? 'text-white' : 'text-gray-600'
                                                    }`}>
                                                        {cat.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Recommended Switch */}
                                    <View className="bg-amber-50 p-4 rounded-2xl flex-row justify-between items-center border border-amber-100">
                                        <View>
                                            <Text className="text-amber-900 font-bold text-lg">Recommended Item</Text>
                                            <Text className="text-amber-700/60 text-xs">Show this at the top of lists</Text>
                                        </View>
                                        <Switch 
                                            value={editingProduct.is_recommended}
                                            onValueChange={(val) => setEditingProduct({...editingProduct, is_recommended: val})}
                                            trackColor={{ false: "#D1D5DB", true: "#D97706" }}
                                            thumbColor={editingProduct.is_recommended ? "#FFF" : "#F3F4F6"}
                                        />
                                    </View>

                                    <View className="h-10" />
                                </View>
                            )}
                        </ScrollView>

                        {/* Save Button */}
                        <TouchableOpacity 
                            onPress={handleSaveProduct}
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
                                    <Text className="text-white font-black text-lg">SAVE CHANGES</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}
