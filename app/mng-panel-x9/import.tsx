import { View, Text, ScrollView, SafeAreaView, Alert, TouchableOpacity, FlatList, Platform } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../src/lib/supabase';
import { 
    ArrowLeft, 
    FileUp, 
    CheckCircle, 
    Trash2,
    Database,
    Zap
} from 'lucide-react-native';

type ImportItem = {
    janCode: string;
    name: string;
    price: number;
    categoryId: number | null;
    isValid: boolean;
};

// Category mapping helper (Client side simple fallback)
const getCategoryId = (catName: string): number => {
    if (!catName) return 5; // UNKNOWN
    if (catName.includes('おにぎり')) return 8; // ONIGIRI
    if (catName.includes('サラダ')) return 6; // DELI
    if (catName.includes('パスタ') || catName.includes('麺')) return 7; // NOODLE
    if (catName.includes('飲み物') || catName.includes('ドリンク')) return 2; // DRINK
    if (catName.includes('パン') || catName.includes('サンド')) return 3; // SNACK
    if (catName.includes('デザート') || catName.includes('スイーツ')) return 4; // DESSERT
    return 1; // BENTO default
};

export default function ImportScreen() {
    const router = useRouter();
    const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
    const [previewData, setPreviewData] = useState<ImportItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [stats, setStats] = useState({ success: 0, error: 0 });
    const [fileInfo, setFileInfo] = useState<{ name: string; size: string; count: number } | null>(null);
    
    const allParsedDataRef = useRef<ImportItem[]>([]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/plain'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;
            setIsProcessing(true);

            const file = result.assets[0];
            let content = '';
            
            if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                content = await response.text();
            } else {
                content = await FileSystem.readAsStringAsync(file.uri);
            }

            const parsed = fastParse(content);
            allParsedDataRef.current = parsed;
            setFileInfo({
                name: file.name,
                size: formatSize(file.size || 0),
                count: parsed.length
            });
            
            setPreviewData(parsed.slice(0, 100)); // Show preview
            setStep('preview');
        } catch (error) {
            Alert.alert('Error', '読み込みに失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    const fastParse = (text: string): ImportItem[] => {
        const lines = text.split(/\n/).filter(l => l.trim().length > 0);
        const results: ImportItem[] = [];
        
        for (const line of lines) {
            const parts = line.split(/[,\t;]/).map(s => s.trim().replace(/^["']|["']$/g, ''));
            if (parts.length < 2) continue;

            const jan = parts[0].replace(/[^0-9]/g, '');
            if (jan.length !== 8 && jan.length !== 13) continue;

            results.push({
                janCode: jan,
                name: (parts[3] || '不明').replace(/^\*/, ''),
                price: parseInt(parts[5] || '0', 10) || 0,
                categoryId: parts[1] ? getCategoryId(parts[1]) : 1,
                isValid: true
            });
        }
        return results;
    };

    const handleResetDB = async () => {
        if (Platform.OS === 'web') {
            if (!window.confirm('WARNING: データベースを完全に初期化しますか？')) return;
        } else {
            // Native alert logic would go here
        }

        setIsProcessing(true);
        try {
            await supabase.from('product_barcodes').delete().neq('jan_code', '0');
            await supabase.from('products').delete().neq('name', 'VOID');
            Alert.alert('Success', 'リセット完了');
            setStep('upload');
        } catch (e) {
            Alert.alert('Error', '失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStartImport = async () => {
        const items = allParsedDataRef.current;
        if (items.length === 0) return;

        setStep('importing');
        setImportProgress(0);
        let s = 0;
        let e = 0;

        const CHUNK_SIZE = 100;

        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            try {
                const { data, error } = await supabase.rpc('bulk_import_v3', { items: chunk, expires_at_val: null });
                if (error) {
                    console.error('Chunk Error:', error);
                    e += chunk.length;
                } else {
                    const res = data as { success: number, error: number };
                    s += res.success;
                    e += res.error;
                }
            } catch (err) {
                e += chunk.length;
            }
            // Update progress
            setImportProgress(Math.round(((i + CHUNK_SIZE) / items.length) * 100));
            setStats({ success: s, error: e });
            
            // Small delay to keep UI responsive
            await new Promise(r => setTimeout(r, 10));
        }

        setTimeout(() => {
            const msg = `完了しました\n成功: ${s}件\n失敗: ${e}件`;
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert('完了', msg);
            }
            router.back();
        }, 500);
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            {/* Header */}
            <View className="p-6 bg-white border-b border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <ArrowLeft size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <Text className="text-xl font-black text-[#1E293B]">Backup Import</Text>
                </View>
                <TouchableOpacity onPress={handleResetDB} className="bg-red-50 p-2 rounded-xl">
                    <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            {step === 'upload' && (
                <View className="flex-1 p-8 justify-center">
                    <TouchableOpacity 
                        onPress={handlePickFile}
                        activeOpacity={0.8}
                        className="bg-white border-2 border-dashed border-blue-200 rounded-[40px] p-12 items-center aspect-square justify-center shadow-xl shadow-blue-100"
                    >
                        <View className="bg-blue-600 w-20 h-20 rounded-3xl items-center justify-center mb-6 shadow-lg shadow-blue-300">
                            <FileUp size={40} color="white" />
                        </View>
                        <Text className="text-2xl font-bold text-[#1E293B] mb-2">Select CSV</Text>
                        <Text className="text-gray-400 text-center text-sm px-6">
                            Tap to browse files
                        </Text>
                    </TouchableOpacity>
                    
                    <View className="mt-12 bg-green-50 p-6 rounded-3xl border border-green-100 flex-row items-start">
                        <Database size={24} color="#059669" />
                        <View className="ml-4 flex-1">
                            <Text className="text-green-800 font-bold mb-1">Local Script Available</Text>
                            <Text className="text-green-600 text-xs leading-5">
                                大量のデータを扱う場合は、PCのターミナルから `npm run seed` を実行する方が高速で確実です。
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {step === 'preview' && (
                <View className="flex-1">
                    <View className="bg-blue-600 p-8 rounded-b-[40px] shadow-lg">
                        <View className="flex-row justify-between items-end">
                            <View>
                                <Text className="text-blue-100 text-xs font-bold tracking-widest uppercase mb-1">Preview</Text>
                                <Text className="text-white text-3xl font-black">{fileInfo?.count.toLocaleString()}</Text>
                                <Text className="text-blue-200 text-sm">Target items</Text>
                            </View>
                            <Zap size={40} color="white" opacity={0.2} />
                        </View>
                    </View>

                    <FlatList 
                        data={previewData}
                        keyExtractor={(item, i) => `${item.janCode}-${i}`}
                        className="px-6 pt-6"
                        renderItem={({ item }) => (
                            <View className="bg-white p-4 rounded-2xl mb-3 flex-row items-center border border-gray-100 shadow-sm">
                                <View className="bg-green-50 w-10 h-10 rounded-xl items-center justify-center mr-4">
                                    <CheckCircle size={20} color="#10B981" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-bold">{item.name}</Text>
                                    <Text className="text-gray-400 text-xs">{item.janCode} • ¥{item.price}</Text>
                                </View>
                            </View>
                        )}
                        ListFooterComponent={<View className="h-40" />}
                    />

                    <View className="absolute bottom-10 left-6 right-6">
                        <TouchableOpacity 
                            onPress={handleStartImport}
                            className="bg-blue-600 py-6 rounded-3xl shadow-xl shadow-blue-300 items-center"
                        >
                            <Text className="text-white font-black text-lg">EXECUTE IMPORT</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {step === 'importing' && (
                <View className="flex-1 p-10 justify-center items-center">
                    <View className="w-full bg-white p-10 rounded-[50px] shadow-2xl items-center border border-gray-100">
                        <View className="relative w-40 h-40 items-center justify-center mb-10">
                            <Text className="text-5xl font-black text-blue-600">{importProgress}%</Text>
                        </View>
                        
                        <Text className="text-2xl font-black text-[#1E293B] mb-2">Importing...</Text>
                        <Text className="text-gray-400 text-center mb-12">
                            Success: {stats.success.toLocaleString()}
                            {'\n'}
                            Errors: {stats.error.toLocaleString()}
                        </Text>

                        <View className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                            <View 
                                className="h-full bg-blue-600 transition-all" 
                                style={{ width: `${importProgress}%` }}
                            />
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}
