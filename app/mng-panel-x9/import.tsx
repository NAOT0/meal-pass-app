import { View, Text, TextInput, ScrollView, SafeAreaView, Alert, Switch, TouchableOpacity, FlatList } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { ArrowLeft, Upload, FileText, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { CATEGORY_IDS } from '../../src/features/recommendation/logic';

// Helper to determine category from string (simple matching, default to 1)
const getCategoryId = (catName: string): number | null => {
    if (!catName) return null; // Return null if not specified
    if (catName.includes('おにぎり')) return CATEGORY_IDS.ONIGIRI;
    if (catName.includes('サラダ')) return CATEGORY_IDS.SALAD;
    if (catName.includes('パスタ') || catName.includes('麺')) return CATEGORY_IDS.NOODLE;
    if (catName.includes('飲み物') || catName.includes('ドリンク')) return CATEGORY_IDS.DRINK;
    if (catName.includes('パン') || catName.includes('サンド')) return CATEGORY_IDS.BREAD;
    if (catName.includes('デザート') || catName.includes('スイーツ')) return CATEGORY_IDS.DESSERT;
    
    // Default to Bento only if explicitly mentioned or fallback strategy is desired?
    // For now, if provided string doesn't match known ones but exists, return null to force verification game?
    // Or default to Bento? 
    // User wants "items without specified category" to go to game.
    // So if catName is empty -> null.
    // If catName is random string -> null?
    return CATEGORY_IDS.BENTO; // Keeping Bento as fallback for now if string exists but no match? Or maybe null?
    // Let's change: if strictly empty -> null. If string exists, try to match, else Bento.
};

type ImportItem = {
    janCode: string;
    name: string;
    price: number;
    categoryId: number | null;
    isValid: boolean;
    error?: string;
    existingProductId?: string; // If found in DB
};

export default function ImportScreen() {
    const router = useRouter();
    const [inputText, setInputText] = useState('');
    const [previewData, setPreviewData] = useState<ImportItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [defaultExpiry, setDefaultExpiry] = useState(true); // Default 24h
    const [step, setStep] = useState<'input' | 'preview'>('input');

    const handleParse = async () => {
        if (!inputText.trim()) {
            Alert.alert('Error', 'Please enter some data');
            return;
        }

        setIsProcessing(true);
        const lines = inputText.split(/\n/);
        const parsed: ImportItem[] = [];
        
        // 1. Parse Lines
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Try CSV: JAN, Name, Price, Category
            const parts = trimmed.split(/,|\t/).map(s => s.trim());
            
            let jan = parts[0];
            let name = parts[1] || '未登録商品'; // Default name if simple list
            let price = parseInt(parts[2] || '100', 10);
            let catName = parts[3] || '';

            // Validation
            let isValid = true;
            let error = '';

            if (!jan || jan.length < 8) { // Basic length check
                isValid = false;
                error = 'Invalid JAN';
            }
            if (isNaN(price)) {
                price = 0;
                // Price 0 is suspicious but maybe allowed? Let's warn.
                // But if it's just a JAN list, price is 0/100 default.
            }

            parsed.push({
                janCode: jan,
                name,
                price,
                categoryId: catName ? getCategoryId(catName) : null, // If no category string, null
                isValid,
                error
            });
        }

        // 2. Check Existing JANs (Batch)
        const jans = parsed.filter(i => i.isValid).map(i => i.janCode);
        if (jans.length > 0) {
            const { data: barcodes } = await supabase
                .from('product_barcodes')
                .select('jan_code, product_id')
                .in('jan_code', jans);
            
            if (barcodes) {
                const janMap = new Map((barcodes as any[]).map(b => [b.jan_code, b.product_id]));
                parsed.forEach(p => {
                    if (janMap.has(p.janCode)) {
                        p.existingProductId = janMap.get(p.janCode);
                    }
                });
            }
        }

        setPreviewData(parsed);
        setStep('preview');
        setIsProcessing(false);
    };

    const handleImport = async () => {
        setIsProcessing(true);
        
        const validItems = previewData.filter(i => i.isValid);
        let successCount = 0;
        let failCount = 0;

        const expiresAt = defaultExpiry ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

        // Process sequentially to avoid strict rate limits or race conditions, 
        // though parallel Promise.all is faster. Let's do batching or parallel chunks if needed.
        // For simplicity: sequential.
        
        for (const item of validItems) {
            try {
                if (item.existingProductId) {
                    // UPDATE
                    // If CSV provided detailed info (name != default?), update it. 
                    // Or always update `expires_at` (bringing it back to stock).
                    // Let's assume we update everything fields + expiry.
                    
                    const updateQuery = (supabase.from('products') as any).update({
                        name: item.name !== '未登録商品' ? item.name : undefined, // Only update name if provided? But we don't know old name here.
                        // Ideally, if it's a simple JAN list, we might NOT want to overwrite Name/Price with defaults.
                        // Heuristic: If name is '未登録商品', assume simple list -> Only update expiry.
                        // If name is NOT '未登録商品', update all.
                        ...(item.name !== '未登録商品' ? {
                            name: item.name,
                            price: item.price,
                            category_id: item.categoryId,
                        } : {}),
                        expires_at: expiresAt,
                        is_active: true // Reactivate it
                    }); // Removed .eq() from here, moved to below
                    
                    const { error } = await updateQuery.eq('id', item.existingProductId);
                    
                    if (!error) successCount++;
                    else failCount++;

                } else {
                    // INSERT
                    const { data: pData, error: pError } = await (supabase.from('products') as any).insert({
                        name: item.name,
                        price: item.price,
                        category_id: item.categoryId, // Can be null
                        expires_at: expiresAt,
                        is_recommended: false,
                        is_active: true,
                        is_verified: !!item.categoryId, // Verified only if category matches
                        is_temporary: false,
                    }) .select().single() as { data: any, error: any };

                    if (pData && !pError) {
                        const { error: bError } = await (supabase.from('product_barcodes') as any).insert({
                            product_id: pData.id,
                            jan_code: item.janCode
                        });
                        
                        if (!bError) successCount++;
                        else failCount++; // Created product but failed barcode... partial fail.
                    } else {
                        failCount++;
                    }
                }
            } catch (e) {
                failCount++;
            }
        }

        setIsProcessing(false);
        Alert.alert(
            'Import Complete', 
            `Success: ${successCount}\nFailed: ${failCount}`,
            [{ text: 'OK', onPress: () => router.back() }]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="p-4 bg-white border-b border-gray-200 flex-row items-center gap-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <ArrowLeft size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-900">一括インポート</Text>
            </View>

            {step === 'input' ? (
                <View className="flex-1 p-4">
                    <Text className="font-bold text-gray-700 mb-2">CSV / テキストデータ</Text>
                    <View className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-100">
                        <Text className="text-xs text-blue-800 font-bold mb-1">フォーマット例 (コピー可)</Text>
                        <Text className="text-xs text-blue-600 font-mono select-selectable">
                            4901234567890, 鮭おにぎり, 150, おにぎり{'\n'}
                            4909876543210, 緑茶 500ml, 120, 飲み物{'\n'}
                            4500000000000 (JANのみも可)
                        </Text>
                    </View>
                    
                    <TextInput 
                        className="flex-1 bg-white border border-gray-300 rounded-lg p-4 text-base font-mono"
                        multiline
                        textAlignVertical="top"
                        placeholder="ここに貼り付け..."
                        value={inputText}
                        onChangeText={setInputText}
                    />
                    
                    <View className="flex-row items-center justify-between py-4">
                         <Text className="font-bold text-gray-700">デフォルト有効期限 (24時間)</Text>
                         <Switch value={defaultExpiry} onValueChange={setDefaultExpiry} />
                    </View>

                    <Button 
                        title="プレビューを作成" 
                        onPress={handleParse} 
                        className="bg-blue-600"
                        disabled={isProcessing}
                    />
                </View>
            ) : (
                <View className="flex-1 bg-white">
                    <View className="p-4 bg-gray-50 border-b border-gray-200 flex-row justify-between items-center">
                        <Text className="font-bold text-gray-600">
                            {previewData.length} 件を検出 ({previewData.filter(i => i.isValid).length} 有効)
                        </Text>
                        <TouchableOpacity onPress={() => setStep('input')}>
                            <Text className="text-blue-600 font-bold">修正する</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <FlatList 
                        data={previewData}
                        keyExtractor={(item, index) => `${item.janCode}-${index}`}
                        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                        renderItem={({ item }) => (
                            <View className={`flex-row items-center p-3 mb-2 rounded border ${item.isValid ? (item.existingProductId ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200') : 'bg-red-50 border-red-200'}`}>
                                <View className="mr-3">
                                    {!item.isValid ? <AlertTriangle size={20} color="#EF4444" /> : 
                                     item.existingProductId ? <RefreshCw size={20} color="#F59E0B" /> : 
                                     <CheckCircle size={20} color="#10B981" />}
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="font-bold text-gray-800">{item.janCode}</Text>
                                        {item.isValid && (
                                            <Text className="text-xs text-gray-500 bg-white px-1 border border-gray-200 rounded">
                                                {item.existingProductId ? '更新' : '新規'}
                                            </Text>
                                        )}
                                    </View>
                                    <Text className="text-gray-600 text-xs mt-1">
                                        {item.name} / ¥{item.price}
                                    </Text>
                                    {!item.isValid && (
                                        <Text className="text-red-500 text-xs font-bold mt-1">{item.error}</Text>
                                    )}
                                </View>
                            </View>
                        )}
                    />
                    
                    <View className="p-4 border-t border-gray-200 absolute bottom-0 w-full bg-white pb-8">
                         <Button 
                            title={isProcessing ? "インポート中..." : "インポート実行"}
                            onPress={handleImport}
                            className="bg-green-600"
                            disabled={isProcessing || previewData.filter(i => i.isValid).length === 0}
                         />
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}
