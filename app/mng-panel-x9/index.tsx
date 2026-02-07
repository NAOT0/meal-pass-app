import { View, Text, TextInput, ScrollView, SafeAreaView, Alert, Switch, TouchableOpacity, FlatList, Image, Modal, Animated, Easing } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { Database } from '../../src/types/schema';
import { CATEGORY_IDS, CATEGORY_LABELS } from '../../src/features/recommendation/logic';
import { signInAnonymously } from '../../src/lib/auth';
import { Trash2, Star, Plus, RefreshCw, Search, ScanBarcode, Settings, LogOut, X, Upload, Layers, Clock, CheckSquare } from 'lucide-react-native';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_barcodes?: { jan_code: string }[] | null;
};

export default function AdminScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'list' | 'add'>('list');

  // Search & Filter State
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'recommended' | 'expired'>('all');

  // Bulk Search State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSearchText, setBulkSearchText] = useState('');
  const [notFoundJans, setNotFoundJans] = useState<string[]>([]);

  // Add Form State
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<number>(1);
  const [isRecommended, setIsRecommended] = useState(false);
  const [newJanCode, setNewJanCode] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDateText, setExpiryDateText] = useState('');

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number>(1);
  const [editJanCode, setEditJanCode] = useState('');
  const [editHasExpiry, setEditHasExpiry] = useState(false);
  const [editExpiryText, setEditExpiryText] = useState('');
  const [editIsRecommended, setEditIsRecommended] = useState(false);

  // Bulk Action State
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'recommend' | 'expiry' | null>(null);
  const [bulkExpiryText, setBulkExpiryText] = useState('');

  useEffect(() => {
    fetchProducts();
  }, [filterType]);

  const handleLogout = async () => {
      await supabase.auth.signOut();
      router.replace('/mng-panel-x9');
  };

  const fetchProducts = async () => {
    setLoading(true);
    setNotFoundJans([]); // Clear not found on refetch
    let query = supabase
      .from('products')
      .select('*, product_barcodes(jan_code)')
      .order('created_at', { ascending: false });

    if (filterType === 'recommended') {
      query = query.eq('is_recommended', true);
    } else if (filterType === 'expired') {
       const now = new Date().toISOString();
       query = query.not('expires_at', 'is', null).lt('expires_at', now);
    }

    const { data, error } = await query;
    if (error) Alert.alert('Error', error.message);
    else setProducts(data as any || []);
    setLoading(false);
  };

  const handleSearch = async () => {
    setLoading(true);
    setNotFoundJans([]);

    // --- BULK MODE ---
    if (isBulkMode) {
        if (!bulkSearchText.trim()) {
            fetchProducts();
            return;
        }

        const jans = bulkSearchText.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
        if (jans.length === 0) {
            setLoading(false);
            return;
        }

        // Fetch product IDs for these barcodes
        const { data: barcodeData, error: barcodeError } = await (supabase
            .from('product_barcodes') as any)
            .select('product_id, jan_code')
            .in('jan_code', jans);
        
        if (barcodeError) {
            Alert.alert('Error', barcodeError.message);
            setLoading(false);
            return;
        }

        const foundJans = new Set(((barcodeData as any[]) || []).map(b => b.jan_code));
        const missing = jans.filter(j => !foundJans.has(j));
        setNotFoundJans(missing);

        const pIds = ((barcodeData as any[]) || []).map(b => b.product_id);
        
        if (pIds.length > 0) {
            const { data: pData } = await (supabase
                .from('products') as any)
                .select('*, product_barcodes(jan_code)')
                .in('id', pIds);
            
            setProducts(pData || []);
        } else {
            setProducts([]);
        }

        setLoading(false);
        return;
    }

    // --- SINGLE MODE ---
    if (!searchText) {
       fetchProducts();
       return;
    }
    
    // Exact logic as before for single search...
    const { data: nameData, error: nameError } = await (supabase
       .from('products') as any)
       .select('*, product_barcodes(jan_code)')
       .ilike('name', `%${searchText}%`);

    const { data: barcodeData } = await (supabase
       .from('product_barcodes') as any)
       .select('product_id')
       .eq('jan_code', searchText);
    
    if (nameError) {
        Alert.alert('Error', nameError.message);
        setLoading(false);
        return;
    }

    let results = nameData || [];
    if (barcodeData && barcodeData.length > 0) {
        const pIds = (barcodeData as any[]).map(b => b.product_id);
         const { data: pData } = await (supabase
            .from('products') as any)
            .select('*, product_barcodes(jan_code)')
            .in('id', pIds);
        
        if (pData) {
            const existingIds = new Set(results.map((r: Product) => r.id));
            pData.forEach((p: Product) => {
                if (!existingIds.has(p.id)) results.push(p as any);
            });
        }
    }
    setProducts(results as any);
    setLoading(false);
  };

  const handleAddProduct = async () => {
     // ... existing ...
     if (!newName || !newPrice || !newJanCode) {
         Alert.alert('Error', 'Name, Price and JAN Code are required');
         return;
       }
  
      let expiresAt = null;
      if (hasExpiry) {
        const date = new Date(expiryDateText);
        if (isNaN(date.getTime())) {
          Alert.alert('Error', 'Invalid date format.');
          return;
        }
        expiresAt = date.toISOString();
      }
  
      setLoading(true);
      const { data: productData, error: productError } = await (supabase.from('products') as any).insert({
        name: newName,
        price: parseInt(newPrice, 10),
        category_id: newCategoryId,
        is_recommended: isRecommended,
        expires_at: expiresAt,
        image_url: newImageUrl || null,
        is_active: true,
        is_verified: true,
        is_temporary: false,
      }).select().single() as { data: any, error: any };
  
      if (productError || !productData) {
        setLoading(false);
        Alert.alert('Error', productError?.message || 'Failed');
        return;
      }
  
      await (supabase.from('product_barcodes') as any).insert({
          product_id: productData.id,
          jan_code: newJanCode
      });
  
      setLoading(false);
      Alert.alert('Success', 'Product added');
      setNewName(''); setNewPrice(''); setNewJanCode(''); setNewImageUrl('');
      setIsRecommended(false); setHasExpiry(false); setExpiryDateText('');
      fetchProducts();
      setTab('list');
  };

  // ... Edit Modal Logic (openEditModal, handleUpdateProduct, handleDelete) ...
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditPrice(String(product.price));
    setEditCategoryId(product.category_id || 1);
    setEditJanCode(product.product_barcodes?.[0]?.jan_code || '');
    setEditIsRecommended(product.is_recommended || false);
    
    if (product.expires_at) {
        setEditHasExpiry(true);
        // Format specific for display inputs if needed, but keeping ISO/simple for now
        // A simple substring YYYY-MM-DD HH:MM
        const d = new Date(product.expires_at);
        // simple formatting for input
        const iso = d.toISOString(); // 2023-01-01T00:00:00.000Z
        setEditExpiryText(iso.slice(0, 16).replace('T', ' '));
    } else {
        setEditHasExpiry(false);
        setEditExpiryText('');
    }
    };

    const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    
    let expiresAt = null;
    if (editHasExpiry) {
        const date = new Date(editExpiryText);
        if (isNaN(date.getTime())) {
            Alert.alert('Error', 'Invalid date format.');
            return;
        }
        expiresAt = date.toISOString();
    }

    setLoading(true);
    
    // Update Product
    const { error: pError } = await (supabase.from('products') as any).update({
        name: editName,
        price: parseInt(editPrice, 10),
        category_id: editCategoryId,
        is_recommended: editIsRecommended,
        expires_at: expiresAt
    }).eq('id', editingProduct.id);

    if (pError) {
        Alert.alert('Error', pError.message);
        setLoading(false);
        return;
    }

    // Update JAN (If changed)
    if (editJanCode) {
        await supabase.from('product_barcodes').delete().eq('product_id', editingProduct.id);
        await (supabase.from('product_barcodes') as any).insert({
            product_id: editingProduct.id,
            jan_code: editJanCode
        });
    }

    setLoading(false);
    setEditingProduct(null);
    fetchProducts();
    Alert.alert('Success', 'Updated successfully');
    };

    const handleDelete = (id: string) => {
    Alert.alert(
        'Delete Product',
        'Are you sure you want to permanently delete this product?',
        [
        { text: 'Cancel', style: 'cancel' },
        { 
            text: 'Delete', 
            style: 'destructive',
            onPress: async () => {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) Alert.alert('Error', error.message);
            else {
                setEditingProduct(null); // Close modal if open
                fetchProducts();
            }
            }
        }
        ]
    );
    };


  // --- BULK ACTION LOGIC ---
  const handleBulkAction = async () => {
      if (!bulkActionType) return;
      
      const targetIds = products.map(p => p.id);
      if (targetIds.length === 0) return;

      Alert.alert(
          'Confirm Bulk Action',
          `Update ${targetIds.length} items?`,
          [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Confirm', onPress: executeBulkAction }
          ]
      );
  };

  const executeBulkAction = async () => {
      setLoading(true);
      const targetIds = products.map(p => p.id);
      
      if (bulkActionType === 'recommend') {
          const { error } = await (supabase
              .from('products') as any)
              .update({ is_recommended: true })
              .in('id', targetIds);
          if (error) Alert.alert('Error', error.message);
          else Alert.alert('Success', 'Marked all as recommended');
      } 
      else if (bulkActionType === 'expiry') {
           const date = new Date(bulkExpiryText);
           if (isNaN(date.getTime())) {
               Alert.alert('Error', 'Invalid Expiry');
               setLoading(false);
               return;
           }
           const { error } = await (supabase
              .from('products') as any)
              .update({ expires_at: date.toISOString() })
              .in('id', targetIds);
           if (error) Alert.alert('Error', error.message);
           else Alert.alert('Success', 'Updated expiry for all');
      }

      setLoading(false);
      setShowBulkActionModal(false);
      fetchProducts(); // Refresh
  };

  const renderItem = ({ item }: { item: Product }) => {
     // ... same as before
     const isExpired = item.expires_at ? new Date(item.expires_at) < new Date() : false;
     const janCode = item.product_barcodes?.[0]?.jan_code || 'No Barcode';
 
     return (
       <View className={`flex-row items-center p-4 bg-white mb-2 rounded-lg border ${isExpired ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
         <View className="flex-1">
           <View className="flex-row items-center gap-2">
              <Text className={`font-bold text-lg ${isExpired ? 'text-gray-400' : 'text-gray-900'}`}>{item.name}</Text>
              {item.is_recommended && <Star size={16} color="#F59E0B" fill="#F59E0B" />}
           </View>
           <Text className="text-gray-500">¥{item.price}</Text>
           <View className="flex-row items-center gap-1 mt-1">
              <ScanBarcode size={12} color="#9CA3AF" />
              <Text className="text-xs text-gray-400">{janCode}</Text>
           </View>
           {item.expires_at && (
             <Text className={`text-xs mt-1 ${isExpired ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
               Exp: {new Date(item.expires_at).toLocaleString()}
               {isExpired ? ' (Expired)' : ''}
             </Text>
           )}
         </View>
 
         <View className="flex-row items-center gap-3">
             <TouchableOpacity 
               onPress={() => openEditModal(item)}
               className="p-3 bg-gray-100 rounded-full"
               hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
             >
                 <Settings size={22} color="#374151" />
             </TouchableOpacity>
         </View>
       </View>
     );
  };


    // Spin Animation
    const spinValue = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        if (loading) {
            Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            spinValue.setValue(0);
            spinValue.stopAnimation();
        }
    }, [loading]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleManualRefresh = () => {
        setSearchText('');
        fetchProducts();
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="p-4 bg-white border-b border-gray-200">
             {/* Toggle Bulk/Single */}
             <View className="flex-row justify-between items-center mb-4">
                <Text className="text-2xl font-bold text-gray-900">商品管理</Text>
                <View className="flex-row gap-2">
                    <TouchableOpacity onPress={() => setIsBulkMode(!isBulkMode)} className={`p-3 rounded-full ${isBulkMode ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <Layers size={22} color={isBulkMode ? '#2563EB' : '#374151'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/mng-panel-x9/import')} className="p-3 bg-green-50 rounded-full" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Upload size={22} color="#059669" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleManualRefresh} className="p-3 bg-gray-100 rounded-full">
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <RefreshCw size={22} color="#374151" />
                        </Animated.View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleLogout} className="p-3 bg-red-50 rounded-full" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <LogOut size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>
             </View>
         
         {/* Search Area */}
         {isBulkMode ? (
             <View className="mb-2">
                 <View className="flex-row items-start bg-gray-100 rounded-lg px-3 py-2">
                    <Layers size={20} color="#9CA3AF" style={{ marginTop: 8 }} />
                    <TextInput 
                        className="flex-1 ml-2 h-20 text-base"
                        placeholder="JANコードを改行またはカンマ区切りで入力"
                        value={bulkSearchText}
                        onChangeText={setBulkSearchText}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />
                    <TouchableOpacity onPress={handleSearch} className="bg-blue-600 p-2 rounded-lg mt-1">
                        <Search size={20} color="white" />
                    </TouchableOpacity>
                 </View>
                 {notFoundJans.length > 0 && (
                     <View className="mt-2 p-2 bg-red-50 border border-red-100 rounded">
                         <Text className="text-red-800 font-bold text-xs">見つかりませんでした:</Text>
                         <Text className="text-red-600 text-xs">{notFoundJans.join(', ')}</Text>
                     </View>
                 )}
                 {/* Bulk Actions (Only if products found in bulk mode) */}
                 {products.length > 0 && (
                     <View className="flex-row gap-2 mt-2">
                         <TouchableOpacity onPress={() => { setBulkActionType('recommend'); handleBulkAction(); }} className="flex-1 bg-orange-100 p-2 rounded items-center flex-row justify-center gap-2">
                             <Star size={16} color="#F59E0B" />
                             <Text className="text-orange-700 font-bold text-xs">全おすすめ</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => { setBulkActionType('expiry'); setShowBulkActionModal(true); }} className="flex-1 bg-blue-100 p-2 rounded items-center flex-row justify-center gap-2">
                             <Clock size={16} color="#2563EB" />
                             <Text className="text-blue-700 font-bold text-xs">全期限設定</Text>
                         </TouchableOpacity>
                     </View>
                 )}
             </View>
         ) : (
            <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-2">
                <Search size={20} color="#9CA3AF" />
                <TextInput 
                    className="flex-1 ml-2 h-10"
                    placeholder="商品名 または JANコード で検索"
                    value={searchText}
                    onChangeText={setSearchText}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                />
            </View>
         )}

         {/* Filters */}
         <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 pb-2">
             <TouchableOpacity onPress={() => setFilterType('all')} className={`px-4 py-2 rounded-full border ${filterType === 'all' ? 'bg-gray-800 border-gray-800' : 'bg-white border-gray-300'}`}>
                 <Text className={`text-xs font-bold ${filterType === 'all' ? 'text-white' : 'text-gray-600'}`}>すべて</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => setFilterType('recommended')} className={`px-4 py-2 rounded-full border ${filterType === 'recommended' ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}>
                 <Text className={`text-xs font-bold ${filterType === 'recommended' ? 'text-white' : 'text-gray-600'}`}>おすすめ中</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => setFilterType('expired')} className={`px-4 py-2 rounded-full border ${filterType === 'expired' ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300'}`}>
                 <Text className={`text-xs font-bold ${filterType === 'expired' ? 'text-white' : 'text-gray-600'}`}>期限切れ</Text>
             </TouchableOpacity>
         </ScrollView>
      </View>

      <View className="flex-row p-4 gap-4">
        <TouchableOpacity onPress={() => setTab('list')} className={`flex-1 py-3 rounded-lg items-center ${tab === 'list' ? 'bg-blue-600' : 'bg-white border border-gray-200'}`}>
            <Text className={`font-bold ${tab === 'list' ? 'text-white' : 'text-gray-600'}`}>一覧リスト</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('add')} className={`flex-1 py-3 rounded-lg items-center ${tab === 'add' ? 'bg-blue-600' : 'bg-white border border-gray-200'}`}>
            <Text className={`font-bold ${tab === 'add' ? 'text-white' : 'text-gray-600'}`}>新規追加</Text>
        </TouchableOpacity>
      </View>

      {/* Render Lists/Forms ... same as before but using the updated products state */}
      {tab === 'list' ? (
        <FlatList
          data={products}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 150 }} 
          refreshing={loading}
          onRefresh={fetchProducts}
          ListEmptyComponent={
              <View className="items-center py-10">
                  <Text className="text-gray-400">商品が見つかりません</Text>
              </View>
          }
        />
      ) : (
        <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 150 }}>
           <View className="bg-white p-6 rounded-xl border border-gray-200 gap-4 mb-20">
               {/* Same Add Form logic ... */}
              <View>
                  <Text className="font-bold mb-2">JANコード (必須)</Text>
                  <TextInput value={newJanCode} onChangeText={setNewJanCode} className="border p-3 rounded-lg h-12" placeholder="49..." keyboardType="numeric" />
              </View>
              <View>
                  <Text className="font-bold mb-2">商品名</Text>
                  <TextInput value={newName} onChangeText={setNewName} className="border p-3 rounded-lg h-12" />
              </View>
              <View>
                  <Text className="font-bold mb-2">価格</Text>
                  <TextInput value={newPrice} onChangeText={setNewPrice} className="border p-3 rounded-lg h-12" keyboardType="numeric" />
              </View>
              <View>
                  <Text className="font-bold mb-2">カテゴリー</Text>
                  <ScrollView horizontal className="gap-2" showsHorizontalScrollIndicator={false}>
                     {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                        const id = CATEGORY_IDS[key as keyof typeof CATEGORY_IDS];
                        return (
                             <TouchableOpacity key={key} onPress={() => setNewCategoryId(id)} className={`px-4 py-3 rounded-full border ${newCategoryId === id ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                 <Text className={newCategoryId === id ? 'text-white font-bold' : 'text-gray-600'}>{String(label)}</Text>
                             </TouchableOpacity>
                        );
                     })}
                  </ScrollView>
              </View>
              <View className="flex-row justify-between py-3 border-t mt-2 items-center">
                  <Text className="font-bold">おすすめ</Text>
                  <Switch value={isRecommended} onValueChange={setIsRecommended} />
              </View>
              <View className="py-2 border-t">
                  <View className="flex-row justify-between mb-2 items-center">
                      <Text className="font-bold">有効期限</Text>
                      <Switch value={hasExpiry} onValueChange={setHasExpiry} />
                  </View>
                  {hasExpiry && <TextInput value={expiryDateText} onChangeText={setExpiryDateText} className="border p-3 rounded-lg h-12" placeholder="YYYY-MM-DD HH:MM" />}
              </View>
              <Button title={loading ? "登録中..." : "登録"} onPress={handleAddProduct} variant="primary" className="mt-4 bg-blue-600 h-14" disabled={loading} />
           </View>
        </ScrollView>
      )}

      {/* Edit Modal (Existing) ... */}
      <Modal visible={!!editingProduct} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView className="flex-1 bg-white">
             {/* ... reuse existing UI just referencing functions ... */}
             <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
                 <Text className="text-xl font-bold">商品を編集</Text>
                 <TouchableOpacity onPress={() => setEditingProduct(null)} className="p-2 bg-gray-100 rounded-full" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                     <X size={24} color="#374151" />
                 </TouchableOpacity>
             </View>
             <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
                 {editingProduct && (
                     <View className="gap-6 pb-20">
                         <View>
                            <Text className="font-bold mb-2">商品名</Text>
                            <TextInput value={editName} onChangeText={setEditName} className="border border-gray-300 p-4 rounded-xl text-lg h-14" />
                         </View>
                         <View>
                            <Text className="font-bold mb-2">JANコード</Text>
                            <TextInput value={editJanCode} onChangeText={setEditJanCode} className="border border-gray-300 p-4 rounded-xl text-lg bg-gray-50 h-14" keyboardType="numeric" />
                         </View>
                         <View>
                            <Text className="font-bold mb-2">価格</Text>
                            <TextInput value={editPrice} onChangeText={setEditPrice} className="border border-gray-300 p-4 rounded-xl text-lg h-14" keyboardType="numeric" />
                         </View>
                         {/* ... categories ... */}
                         <View>
                            <Text className="font-bold mb-2">カテゴリー</Text>
                            <ScrollView horizontal className="gap-2" showsHorizontalScrollIndicator={false}>
                                {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                                    const id = CATEGORY_IDS[key as keyof typeof CATEGORY_IDS];
                                    return (
                                        <TouchableOpacity key={key} onPress={() => setEditCategoryId(id)} className={`px-4 py-3 rounded-xl border ${editCategoryId === id ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                            <Text className={editCategoryId === id ? 'text-white font-bold' : 'text-gray-600'}>{String(label)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                         </View>
                         <View className="flex-row justify-between items-center p-4 bg-gray-50 rounded-xl">
                            <Text className="font-bold text-lg">おすすめ設定</Text>
                            <Switch value={editIsRecommended} onValueChange={setEditIsRecommended} />
                         </View>
                         <View className="p-4 bg-gray-50 rounded-xl gap-4">
                            <View className="flex-row justify-between items-center">
                                <Text className="font-bold text-lg">有効期限</Text>
                                <Switch value={editHasExpiry} onValueChange={setEditHasExpiry} />
                            </View>
                            {editHasExpiry && (
                                <TextInput value={editExpiryText} onChangeText={setEditExpiryText} className="border border-gray-300 p-3 rounded-lg bg-white h-12" placeholder="YYYY-MM-DD HH:MM" />
                            )}
                         </View>

                         <Button title="変更を保存" onPress={handleUpdateProduct} variant="primary" className="bg-blue-600 h-14" textClassName="text-lg" />
                         
                         <View className="mt-8 border-t border-gray-200 pt-8 items-center">
                             <TouchableOpacity onPress={() => handleDelete(editingProduct.id)} className="flex-row items-center gap-2 p-4 bg-red-50 w-full justify-center rounded-xl">
                                 <Trash2 size={24} color="#EF4444" />
                                 <Text className="text-red-500 font-bold text-lg">この商品を完全に削除</Text>
                             </TouchableOpacity>
                         </View>
                     </View>
                 )}
             </ScrollView>
          </SafeAreaView>
      </Modal>

      {/* Bulk Action Modal (Expiry) */}
      <Modal visible={showBulkActionModal} transparent animationType="fade">
          <View className="flex-1 bg-black/50 justify-center items-center p-4">
              <View className="bg-white rounded-xl p-6 w-full max-w-sm">
                  <Text className="text-xl font-bold mb-4">一括期限設定</Text>
                  <Text className="text-gray-600 mb-2">対象: {products.length} 件</Text>
                  <TextInput 
                     value={bulkExpiryText}
                     onChangeText={setBulkExpiryText}
                     className="border border-gray-300 p-3 rounded-lg mb-4"
                     placeholder="YYYY-MM-DD HH:MM"
                  />
                  <View className="flex-row gap-3">
                      <Button title="キャンセル" onPress={() => setShowBulkActionModal(false)} variant="ghost" className="flex-1 bg-gray-100" textClassName="text-gray-600" />
                      <Button title="実行" onPress={() => { setBulkActionType('expiry'); handleBulkAction(); }} variant="primary" className="flex-1 bg-blue-600" />
                  </View>
              </View>
          </View>
      </Modal>

    </SafeAreaView>
  );
}
