
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, StatusBar, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Flashlight, FlashlightOff, X, CheckCircle2, ShoppingCart } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Database } from '../types/schema';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

type Product = Database['public']['Tables']['products']['Row'];

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (product: Product) => void;
  totalBudget: number;
  currentTotal: number;
  cartItems: Product[];
  quantities: Record<string, number>;
  // New props for CartDrawer
  allProducts: Product[];
  candidates: Product[]; // Add this
  onUpdateQuantity: (productId: string, delta: number) => void;
  onToggleLock: (productId: string) => void;
  lockedIds: Set<string>;
  onDeleteItem: (productId: string) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCAN_FRAME_SIZE = 240;

export const BarcodeScanner = ({ 
  visible, 
  onClose, 
  onScan, 
  totalBudget, 
  currentTotal, 
  cartItems, 
  quantities,
  allProducts,
  candidates, // Destructure
  onUpdateQuantity,
  onToggleLock,
  lockedIds,
  onDeleteItem
}: BarcodeScannerProps) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const router = useRouter();
  
  const insets = useSafeAreaInsets();
  
  // To prevent rapid duplicate scans
  const lastScannedCodeRef = useRef<string | null>(null);
  const lockScanRef = useRef(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || lockScanRef.current) return;
    
    // Basic EAN-13 validation
    if (!/^\d{13}$/.test(data)) return;
    if (data === lastScannedCodeRef.current) return;

    lockScanRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    console.log('Scanned:', data);

    try {
      // Search in product_barcodes
      const { data: barcodeData, error: barcodeError } = await supabase
        .from('product_barcodes')
        .select('product_id')
        .eq('jan_code', data)
        .limit(1)
        .maybeSingle();

      if (barcodeError || !barcodeData) {
        console.log('Product not found for barcode:', data);
         setTimeout(() => {
            lockScanRef.current = false;
         }, 1000);
        return;
      }

      const pId = (barcodeData as any).product_id;

      // Fetch product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', pId)
        .returns<Product>()
        .single();
      
      if (productError || !product) {
        console.log('Product details fetch error:', productError);
        setTimeout(() => { lockScanRef.current = false; }, 1000);
        return;
      }

      // Success
      setScanned(true);
      lastScannedCodeRef.current = data;
      
      onScan(product as Product);
      
      showToast((product as Product).name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setScanned(false);
        lockScanRef.current = false;
        setTimeout(() => { lastScannedCodeRef.current = null; }, 3000);
      }, 2000); 

    } catch (error) {
      console.error('Scan handling error:', error);
      lockScanRef.current = false;
    }
  };

  const showToast = (name: string) => {
    setToastMessage(name);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  if (!visible) return null;

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 items-center justify-center bg-gray-900 p-6">
          <Text className="text-white text-center mb-4 font-bold text-lg">カメラの使用許可が必要です</Text>
          <Text className="text-gray-400 text-center mb-8">バーコードを読み取るためにカメラへのアクセスを許可してください。</Text>
          <TouchableOpacity 
            onPress={requestPermission} 
            className="bg-blue-600 px-8 py-4 rounded-full w-full"
          >
            <Text className="text-white font-bold text-center text-lg">許可する</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} className="mt-6">
            <Text className="text-blue-400 font-bold">閉じる</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const remaining = Math.max(0, totalBudget - currentTotal);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <View style={styles.container}>
            <CameraView 
                style={StyleSheet.absoluteFill} 
                facing="back"
                enableTorch={torchOn}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["ean13"],
                }}
            />
            
            {/* Header / Info Bar */}
            <View 
                className="absolute top-0 left-0 right-0 bg-black/60 px-6 pb-4"
                style={{ paddingTop: insets.top + 10 }}
            >
                <View className="flex-row justify-between items-center mb-4">
                     <TouchableOpacity onPress={onClose} className="w-10 h-10 bg-gray-800/80 rounded-full items-center justify-center">
                        <X size={20} color="white" />
                    </TouchableOpacity>
                     <Text className="text-white font-bold text-lg">スキャン</Text>
                     <View className="w-10" />
                </View>

                {/* Simple Total Display */}
                <View className="items-center mt-4">
                    <View className="bg-black/60 px-6 py-2 rounded-full border border-white/20">
                        {/* currentTotal is now passed as ONLY selected items sum from parent */}
                        <Text className="text-white font-bold text-xl">
                            スキャン済み合計: ¥{currentTotal}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Center Frame */}
            <View className="flex-1 items-center justify-center mt-20">
                <View style={{ width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE }} className="relative">
                    {/* Frame Corners */}
                    <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                    <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                    <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                    <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                    
                    {!scanned && (
                       <View className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500/80 shadow-sm shadow-red-500" /> 
                    )}
                </View>
                <Text className="text-gray-300 text-sm mt-8 bg-black/60 px-4 py-1 rounded-full overflow-hidden">
                    バーコードを枠内に合わせてください
                </Text>
            </View>

            {/* Bottom Controls (Torch) */}
            <View 
                className="absolute bottom-10 left-0 right-0 items-center justify-center flex-row"
                style={{ paddingBottom: insets.bottom }}
            >
                <TouchableOpacity
                    onPress={() => setTorchOn(!torchOn)}
                    className={`w-14 h-14 rounded-full items-center justify-center ${torchOn ? 'bg-white' : 'bg-gray-800/80 border border-gray-600'}`}
                >
                    {torchOn ? (
                        <Flashlight size={24} color="black" />
                    ) : (
                        <FlashlightOff size={24} color="#9CA3AF" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Cart FAB */}
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => {
                    onClose(); // まずスキャナーを閉じてから
                    setTimeout(() => {
                        router.push('/cart'); // 買い物かごを開く
                    }, 100); // 閉じきる時間をわずかに待つとより安定します
                }}
                className="absolute right-6 bg-emerald-500 w-16 h-16 rounded-full items-center justify-center shadow-lg shadow-black/50 overflow-visible"
                style={{ bottom: insets.bottom + 40 }}
            >
                 <ShoppingCart size={28} color="white" />
                 {cartItems.length > 0 && (
                     <View className="absolute -top-1 -right-1 bg-red-500 w-6 h-6 rounded-full items-center justify-center border border-white">
                         <Text className="text-white text-xs font-bold">
                             {cartItems.length > 99 ? '99+' : cartItems.length}
                         </Text>
                     </View>
                 )}
            </TouchableOpacity>

            {/* Success Toast */}
            {toastMessage && (
                <View 
                    className="absolute items-center w-full"
                    style={{ bottom: insets.bottom + 120 }}
                >
                    <View className="bg-white/95 px-6 py-4 rounded-2xl shadow-lg flex-row items-center gap-3 border border-gray-100 max-w-[90%]">
                        <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
                            <CheckCircle2 size={18} color="#10B981" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>
                                {toastMessage}
                            </Text>
                            <Text className="text-gray-500 text-xs">
                                カートに追加しました
                            </Text>
                        </View>
                    </View>
                </View>
            )}

        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
});
