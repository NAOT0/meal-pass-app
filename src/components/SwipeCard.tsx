import { forwardRef, useImperativeHandle } from 'react';
import { View, Text, PanResponder, Animated, Dimensions } from 'react-native';
import { useRef } from 'react';
import { Database } from '../types/schema';

type Product = Database['public']['Tables']['products']['Row'];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 120;

interface SwipeCardProps {
  product: Product;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export interface SwipeCardRef {
  swipe: (direction: 'left' | 'right' | 'up' | 'down') => void;
}

export const SwipeCard = forwardRef<SwipeCardRef, SwipeCardProps>(({ product, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }, ref) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const rotation = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp'
  });

  const forceSwipe = (direction: 'left' | 'right' | 'up' | 'down') => {
    let xValue = 0;
    let yValue = 0;

    switch (direction) {
      case 'left': xValue = -SCREEN_WIDTH - 100; break;
      case 'right': xValue = SCREEN_WIDTH + 100; break;
      case 'up': yValue = -SCREEN_HEIGHT - 100; break;
      case 'down': yValue = SCREEN_HEIGHT + 100; break;
    }

    Animated.timing(pan, {
      toValue: { x: xValue, y: yValue },
      duration: 300,
      useNativeDriver: false
    }).start(() => {
      if (direction === 'left') onSwipeLeft();
      else if (direction === 'right') onSwipeRight();
      else if (direction === 'up' && onSwipeUp) onSwipeUp(); // Use prop if available
      else if (direction === 'down' && onSwipeDown) onSwipeDown();
      
      // Reset position immediately after callback so next card (if reused) is centered
      pan.setValue({ x: 0, y: 0 }); 
    });
  };

  useImperativeHandle(ref, () => ({
    swipe: (direction) => forceSwipe(direction)
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      }
    })
  ).current;

  // ... (resetPosition, opacity interpolation logic remains same) ...
  const resetPosition = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false
    }).start();
  };

  const likeOpacity = pan.x.interpolate({
    inputRange: [10, SCREEN_WIDTH / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, -10],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: rotation }] },
        { position: 'absolute', width: '100%', alignItems: 'center' }
      ]}
      className="z-10"
    >
      <View className="bg-white w-[90%] h-[420px] rounded-2xl shadow-xl border border-gray-200 p-6 justify-center items-center">
        
        {/* Indicators */}
        <Animated.View style={{ opacity: likeOpacity, position: 'absolute', top: 40, left: 40, transform: [{ rotate: '-30deg' }] }}>
          <Text className="text-green-500 text-4xl font-extrabold border-4 border-green-500 rounded px-2">MEAL</Text>
        </Animated.View>
        <Animated.View style={{ opacity: nopeOpacity, position: 'absolute', top: 40, right: 40, transform: [{ rotate: '30deg' }] }}>
          <Text className="text-red-500 text-4xl font-extrabold border-4 border-red-500 rounded px-2">SNACK</Text>
        </Animated.View>

        <View className="bg-gray-100 w-32 h-32 rounded-full mb-6 items-center justify-center">
          <Text className="text-5xl">🍔</Text>
        </View>

        <Text className="text-2xl font-bold text-gray-800 text-center mb-2">{product.name}</Text>
        <Text className="text-xl text-gray-500 mb-6">¥{product.price}</Text>
        
        <View className="flex-row gap-4 mt-auto w-full justify-between px-2">
          <View className="items-center">
            <Text className="text-gray-400 text-xs mb-1">Left</Text>
            <View className="bg-red-50 px-3 py-1 rounded border border-red-100">
               <Text className="text-red-500 font-bold">お菓子</Text>
            </View>
          </View>
          <View className="items-center">
            <Text className="text-gray-400 text-xs mb-1">Right</Text>
            <View className="bg-green-50 px-3 py-1 rounded border border-green-100">
               <Text className="text-green-600 font-bold">主食</Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});
