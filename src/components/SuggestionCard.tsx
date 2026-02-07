import { View, Text } from 'react-native';
import { Database } from '../../types/schema';

type Product = Database['public']['Tables']['products']['Row'];

interface SuggestionCardProps {
  items: Product[];
  totalPrice: number;
  index: number;
}

export function SuggestionCard({ items, totalPrice, index }: SuggestionCardProps) {
  return (
    <View className="bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="font-bold text-lg text-gray-800">プラン {String.fromCharCode(65 + index)}</Text>
        <Text className="font-bold text-xl text-blue-600">¥{totalPrice.toLocaleString()}</Text>
      </View>
      
      <View className="space-y-2">
        {items.map((item, idx) => (
          <View key={`${item.id}-${idx}`} className="flex-row justify-between border-b border-gray-50 pb-2">
            <Text className="text-gray-700 flex-1">{item.name}</Text>
            <Text className="text-gray-500 w-16 text-right">¥{item.price}</Text>
          </View>
        ))}
      </View>
      
      <View className="mt-3 bg-blue-50 p-2 rounded items-center">
         <Text className="text-blue-800 text-xs font-semibold">
           {items.length}点の商品・使い切り率 {items.length > 0 ? 'Good' : 'Low'}
         </Text>
      </View>
    </View>
  );
}
