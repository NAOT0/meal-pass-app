
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Flashlight, FlashlightOff, X, CheckCircle2, ShoppingCart } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { Database } from '../src/types/schema';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCartStore } from '../src/store/useCartStore';

// Native-only imports (conditionally used)
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  const expoCamera = require('expo-camera');
  CameraView = expoCamera.CameraView;
  useCameraPermissions = expoCamera.useCameraPermissions;
}

type Product = Database['public']['Tables']['products']['Row'];
const SCAN_FRAME_SIZE = 240;

// ─── Web Scanner Component ───────────────────────────────────────────────────
function WebScanner({ onBarcodeDetected, active }: { onBarcodeDetected: (code: string) => void; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<any>(null);
  const scanIntervalRef = useRef<any>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const setup = async () => {
      try {
        // 1. Initialize BarcodeDetector (with polyfill)
        let BarcodeDetectorClass: any = null;

        // Try native BarcodeDetector first
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          BarcodeDetectorClass = (window as any).BarcodeDetector;
          // Check if ean_13 is supported
          try {
            const formats = await BarcodeDetectorClass.getSupportedFormats();
            if (!formats.includes('ean_13')) {
              BarcodeDetectorClass = null; // Fallback to polyfill
            }
          } catch {
            BarcodeDetectorClass = null;
          }
        }

        // Use polyfill if native not available
        if (!BarcodeDetectorClass) {
          const { BarcodeDetector } = await import('barcode-detector');
          BarcodeDetectorClass = BarcodeDetector;
        }

        detectorRef.current = new BarcodeDetectorClass({ formats: ['ean_13'] });
        console.log('[Web Scanner] BarcodeDetector initialized');

        // 2. Get camera stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setCameraReady(true);
          console.log('[Web Scanner] Camera stream started');
        }
      } catch (err: any) {
        console.error('[Web Scanner] Setup error:', err);
        setError(err.message || 'カメラを起動できませんでした');
      }
    };

    setup();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  // Scanning loop
  useEffect(() => {
    if (!cameraReady || !detectorRef.current || !active) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    const scanFrame = async () => {
      if (!videoRef.current || !detectorRef.current) return;

      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          for (const barcode of barcodes) {
            const code = barcode.rawValue;
            if (/^\d{13}$/.test(code)) {
              console.log('[Web Scanner] Detected:', code);
              onBarcodeDetected(code);
              break;
            }
          }
        }
      } catch (err) {
        // Detection errors are common and can be ignored
      }
    };

    // Scan every 250ms for balanced performance
    scanIntervalRef.current = setInterval(scanFrame, 250);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraReady, active, onBarcodeDetected]);

  if (error) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', padding: 20 }}>
          ⚠️ {error}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', paddingHorizontal: 40 }}>
          ブラウザのカメラ許可設定を確認してください
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* @ts-ignore - Web-only HTML element */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        autoPlay
        playsInline
        muted
      />
      {/* Hidden canvas for frame capture if needed */}
      {/* @ts-ignore */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
}

// ─── Main Scanner Screen ─────────────────────────────────────────────────────
export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [torchOn, setTorchOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [webCameraReady, setWebCameraReady] = useState(Platform.OS !== 'web');
  
  const { currentList, lockedIds, quantities, budget, addFromScan } = useCartStore();

  // Native camera permissions (only used on native)
  const nativePermissionHook = Platform.OS !== 'web' ? useCameraPermissions : null;
  const [permission, requestPermission] = nativePermissionHook ? nativePermissionHook() : [{ granted: true, status: 'granted' }, () => {}];

  // To prevent rapid duplicate scans
  const lastScannedCodeRef = useRef<string | null>(null);
  const lockScanRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      if (permission?.status === 'denied') {
        router.back();
      } else if (permission?.status === 'undetermined' || (permission && !permission.granted)) {
        requestPermission();
      }
    }
  }, [permission]);

  const processBarcode = useCallback(async (data: string) => {
    if (scanned || lockScanRef.current) return;
    if (!/^\d{13}$/.test(data)) return;
    if (data === lastScannedCodeRef.current) return;

    lockScanRef.current = true;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const { data: barcodeData, error: barcodeError } = await supabase
        .from('product_barcodes')
        .select('product_id')
        .eq('jan_code', data)
        .limit(1)
        .maybeSingle();

      if (barcodeError || !barcodeData) {
         console.log('[Scanner] Barcode not found in DB:', data);
         setTimeout(() => { lockScanRef.current = false; }, 1000);
         return;
      }

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', (barcodeData as any).product_id)
        .single();
      
      if (productError || !productData) {
        console.log('[Scanner] Product not found:', (barcodeData as any).product_id);
        setTimeout(() => { lockScanRef.current = false; }, 1000);
        return;
      }

      const product = productData as Product;

      // Success
      setScanned(true);
      lastScannedCodeRef.current = data;
      addFromScan(product);
      
      showToast(product.name);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setTimeout(() => {
        setScanned(false);
        lockScanRef.current = false;
        setTimeout(() => { lastScannedCodeRef.current = null; }, 3000);
      }, 2000); 

    } catch (error) {
      console.error('[Scanner] Error:', error);
      lockScanRef.current = false;
    }
  }, [scanned, addFromScan]);

  // Native barcode handler
  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    processBarcode(data);
  }, [processBarcode]);

  // Web barcode handler
  const handleWebBarcodeDetected = useCallback((code: string) => {
    processBarcode(code);
  }, [processBarcode]);

  const showToast = (name: string) => {
    setToastMessage(name);
    setTimeout(() => { setToastMessage(null); }, 2500);
  };

  // Native: check permission
  if (Platform.OS !== 'web' && (!permission || !permission.granted)) {
    return <View className="flex-1 bg-black" />;
  }

  const lockedTotal = currentList
    .filter(i => lockedIds.has(i.id))
    .reduce((sum, item) => sum + (item.price * (quantities[item.id] || 1)), 0);

  return (
    <View className="flex-1 bg-black">
        <StatusBar barStyle="light-content" />

        {/* Camera: Platform-specific */}
        {Platform.OS === 'web' ? (
          <WebScanner 
            onBarcodeDetected={handleWebBarcodeDetected} 
            active={!scanned} 
          />
        ) : (
          CameraView && (
            <CameraView 
              style={StyleSheet.absoluteFill} 
              facing="back"
              enableTorch={torchOn}
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["ean13"] }}
            />
          )
        )}
        
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
                
                {/* Scanning line */}
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

            {/* Torch (Center) - Only show on native */}
            {Platform.OS !== 'web' ? (
              <TouchableOpacity
                  onPress={() => setTorchOn(!torchOn)}
                  className={`w-14 h-14 rounded-full items-center justify-center backdrop-blur-md border ${torchOn ? 'bg-white border-white' : 'bg-white/20 border-white/30'}`}
              >
                  {torchOn ? <Flashlight size={24} color="#7D926B" /> : <FlashlightOff size={24} color="white" />}
              </TouchableOpacity>
            ) : (
              <View className="w-14 h-14" />
            )}

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
