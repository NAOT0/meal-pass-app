
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
    if (permission?.status === 'denied') {
      router.back();
    } else if (permission?.status === 'undetermined' || (permission && !permission.granted)) {
      requestPermission();
    }
  }, [permission]);

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

  if (!permission || !permission.granted) return <View className="flex-1 bg-black" />;

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
        
        {/* Header Overlay */}
        <View className="absolute top-0 left-0 right-0 bg-black/40 px-6 pb-6" style={{ paddingTop: insets.top + 10 }}>
            <View className="flex-row justify-center items-center mb-4">
                 <Text className="text-white font-bold text-lg tracking-wider">スキャン</Text>
            </View>
            <View className="items-center">
                <View className="bg-sage-green/90 px-8 py-3 rounded-2xl border border-white/20 shadow-lg">
                    <Text className="text-white font-bold text-2xl">合計: ¥{lockedTotal}</Text>
                </View>
            </View>
        </View>

        {/* Frame */}
        <View className="flex-1 items-center justify-center">
            <View style={{ width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE }} className="relative">
                {/* Sage Green Corners */}
                <View className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-sage-green rounded-tl-2xl" />
                <View className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-sage-green rounded-tr-2xl" />
                <View className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-sage-green rounded-bl-2xl" />
                <View className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-sage-green rounded-br-2xl" />
                
                {/* Scanning line animation could be here, simple placeholder for now */}
                {!scanned && <View className="absolute top-1/2 left-4 right-4 h-[1px] bg-white opacity-40 shadow-sm" />}
            </View>
            <Text className="text-white/60 font-medium mt-10 text-xs tracking-widest">枠内にバーコードを合わせてください</Text>
        </View>

        {/* Bottom Controls */}
        <View className="absolute bottom-10 left-0 right-0 px-8 flex-row justify-between items-center" style={{ marginBottom: insets.bottom }}>
            {/* Close Button (Left) */}
            <TouchableOpacity
                onPress={() => router.back()}
                className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 items-center justify-center shadow-lg"
            >
                <X size={24} color="white" />
            </TouchableOpacity>

            {/* Torch (Center) */}
            <TouchableOpacity
                onPress={() => setTorchOn(!torchOn)}
                className={`w-14 h-14 rounded-full items-center justify-center backdrop-blur-md border ${torchOn ? 'bg-white border-white' : 'bg-white/20 border-white/30'}`}
            >
                {torchOn ? <Flashlight size={24} color="#7D926B" /> : <FlashlightOff size={24} color="white" />}
            </TouchableOpacity>

            {/* Cart FAB (Right) */}
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/cart')}
                className="bg-sage-green w-16 h-16 rounded-full items-center justify-center shadow-xl border-2 border-white/40"
            >
                 <ShoppingCart size={28} color="white" />
                 {currentList.filter(i => lockedIds.has(i.id)).length > 0 && (
                     <View className="absolute -top-1 -right-1 bg-white w-6 h-6 rounded-full items-center justify-center shadow-sm">
                         <Text className="text-sage-green text-[10px] font-black">
                             {currentList.filter(i => lockedIds.has(i.id)).length}
                         </Text>
                     </View>
                 )}
            </TouchableOpacity>
        </View>

        {/* Toast Notification (Brand Aligned) */}
        {toastMessage && (
            <View className="absolute items-center w-full shadow-2xl" style={{ bottom: insets.bottom + 120 }}>
                <View className="bg-white px-6 py-4 rounded-2xl flex-row items-center gap-4 border border-sage-green/10 max-w-[85%]">
                    <View className="w-10 h-10 rounded-full bg-sage-green/10 items-center justify-center">
                        <CheckCircle2 size={24} color="#7D926B" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-gray-800 font-bold text-[15px]" numberOfLines={1}>{toastMessage}</Text>
                        <Text className="text-gray-400 text-[10px] font-medium">リストに追加しました</Text>
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
