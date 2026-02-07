import { Tabs } from 'expo-router';
import { AdminGuard } from '../../src/components/AdminGuard';
import { Package, Vote, BarChart } from 'lucide-react-native';

export default function AdminLayout() {
  return (
    <AdminGuard>
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563EB' }}>
        <Tabs.Screen
          name="index"
          options={{
            title: '商品管理',
            tabBarIcon: ({ color }) => <Package size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="votes"
          options={{
            title: 'リクエスト',
            tabBarIcon: ({ color }) => <BarChart size={24} color={color} />,
          }}
        />
      </Tabs>
    </AdminGuard>
  );
}
