
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Flashlight, FlashlightOff, X, CheckCircle2, ShoppingCart } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { Database } from '../src/types/schema';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCartStore } from '../src/store/useCartStore';

type Product = Database['public']['Tables']['products']['Row'];
const SCAN_FRAME_SIZE = 240;

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const { currentList, lockedIds, quantities, budget, addFromScan } = useCartStore();

  // To prevent rapid duplicate scans
  const lastScannedCodeRef = useRef<string | null>(null);
  const lockScanRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || lockScanRef.current) return;
    if (!/^\d{13}$/.test(data)) return;
    if (data === lastScannedCodeRef.current) return;

    lockScanRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data: barcodeData, error: barcodeError } = await supabase
        .from('product_barcodes')
        .select('product_id')
        .eq('jan_code', data)
        .limit(1)
        .maybeSingle();

      if (barcodeError || !barcodeData) {
         setTimeout(() => { lockScanRef.current = false; }, 1000);
         return;
      }

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', (barcodeData as any).product_id)
        .single();
      
      if (productError || !productData) {
        setTimeout(() => { lockScanRef.current = false; }, 1000);
        return;
      }

      const product = productData as Product;

      // Success
      setScanned(true);
      lastScannedCodeRef.current = data;
      addFromScan(product);
      
      showToast(product.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setScanned(false);
        lockScanRef.current = false;
        setTimeout(() => { lastScannedCodeRef.current = null; }, 3000);
      }, 2000); 

    } catch (error) {
      lockScanRef.current = false;
    }
  };

  const showToast = (name: string) => {
    setToastMessage(name);
    setTimeout(() => { setToastMessage(null); }, 2500);
  };

  if (!permission) return <View className="flex-1 bg-black" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-900 p-6">
        <Text className="text-white text-center mb-4 font-bold text-lg">カメラの使用許可が必要です</Text>
        <TouchableOpacity onPress={requestPermission} className="bg-blue-600 px-8 py-4 rounded-full w-full">
          <Text className="text-white font-bold text-center text-lg">許可する</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-6">
          <Text className="text-blue-400 font-bold">戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lockedTotal = currentList
    .filter(i => lockedIds.has(i.id))
    .reduce((sum, item) => sum + (item.price * (quantities[item.id] || 1)), 0);

  return (
    <View className="flex-1 bg-black">
        <StatusBar barStyle="light-content" />
        <CameraView 
            style={StyleSheet.absoluteFill} 
            facing="back"
            enableTorch={torchOn}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["ean13"] }}
        />
        
        {/* Header */}
        <View className="absolute top-0 left-0 right-0 bg-black/60 px-6 pb-4" style={{ paddingTop: insets.top + 10 }}>
            <View className="flex-row justify-between items-center mb-4">
                 <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-gray-800/80 rounded-full items-center justify-center">
                    <X size={20} color="white" />
                </TouchableOpacity>
                 <Text className="text-white font-bold text-lg">スキャン</Text>
                 <View className="w-10" />
            </View>
            <View className="items-center mt-4">
                <View className="bg-black/60 px-6 py-2 rounded-full border border-white/20">
                    <Text className="text-white font-bold text-xl">合計: ¥{lockedTotal}</Text>
                </View>
            </View>
        </View>

        {/* Frame */}
        <View className="flex-1 items-center justify-center mt-20">
            <View style={{ width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE }} className="relative">
                <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                {!scanned && <View className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500/80" />}
            </View>
        </View>

        {/* Bottom Controls */}
        <View className="absolute bottom-10 left-0 right-0 px-6 flex-row justify-between items-center" style={{ marginBottom: insets.bottom }}>
            {/* Close Button (Left) */}
            <TouchableOpacity
                onPress={() => router.back()}
                className="w-14 h-14 rounded-full bg-gray-800/80 border border-gray-600 items-center justify-center shadow-lg"
            >
                <X size={24} color="white" />
            </TouchableOpacity>

            {/* Torch (Center) */}
            <TouchableOpacity
                onPress={() => setTorchOn(!torchOn)}
                className={`w-14 h-14 rounded-full items-center justify-center ${torchOn ? 'bg-white' : 'bg-gray-800/80 border border-gray-600'}`}
            >
                {torchOn ? <Flashlight size={24} color="black" /> : <FlashlightOff size={24} color="#9CA3AF" />}
            </TouchableOpacity>

            {/* Cart FAB (Right) */}
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/cart')}
                className="bg-emerald-500 w-16 h-16 rounded-full items-center justify-center shadow-lg"
            >
                 <ShoppingCart size={28} color="white" />
                 {currentList.filter(i => lockedIds.has(i.id)).length > 0 && (
                     <View className="absolute -top-1 -right-1 bg-red-500 w-6 h-6 rounded-full items-center justify-center border border-white">
                         <Text className="text-white text-xs font-bold">
                             {currentList.filter(i => lockedIds.has(i.id)).length}
                         </Text>
                     </View>
                 )}
            </TouchableOpacity>
        </View>

        {/* Toast */}
        {toastMessage && (
            <View className="absolute items-center w-full" style={{ bottom: insets.bottom + 120 }}>
                <View className="bg-white/95 px-6 py-4 rounded-2xl shadow-lg flex-row items-center gap-3 border border-gray-100 max-w-[90%]">
                    <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
                        <CheckCircle2 size={18} color="#10B981" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>{toastMessage}</Text>
                        <Text className="text-gray-500 text-xs">カートに追加しました</Text>
                    </View>
                </View>
            </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});
