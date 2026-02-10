import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../src/lib/supabase';
import { 
  LayoutDashboard, 
  Package, 
  Upload, 
  Settings, 
  Database, 
  ChevronRight, 
  TrendingUp,
  BarChart3,
  LogOut
} from 'lucide-react-native';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalProducts: 0,
        unverifiedCount: 0,
        activeCategories: 0
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
        const { count: unverified } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_verified', false);
        const { count: categoriesCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });

        setStats({
            totalProducts: productsCount || 0,
            unverifiedCount: unverified || 0,
            activeCategories: categoriesCount || 0
        });
    };

    const MenuCard = ({ title, subtitle, icon: Icon, color, onPress, badge }: any) => (
        <TouchableOpacity 
            onPress={onPress}
            activeOpacity={0.7}
            className="bg-white p-6 rounded-3xl mb-4 shadow-sm border border-gray-100 flex-row items-center justify-between"
        >
            <View className="flex-row items-center flex-1">
                <View className={`${color} w-14 h-14 rounded-2xl items-center justify-center mr-4 shadow-sm`}>
                    <Icon size={28} color="white" />
                </View>
                <View>
                    <Text className="text-gray-900 font-bold text-lg">{title}</Text>
                    <Text className="text-gray-500 text-sm">{subtitle}</Text>
                </View>
            </View>
            {badge ? (
                <View className="bg-red-500 px-2 py-1 rounded-full">
                    <Text className="text-white text-[10px] font-bold">{badge}</Text>
                </View>
            ) : (
                <ChevronRight size={20} color="#CBD5E1" />
            )}
        </TouchableOpacity>
    );

    const StatMiniCard = ({ label, value, color }: any) => (
        <View className="bg-white p-4 rounded-2xl flex-1 mx-1 border border-gray-100 shadow-sm">
            <Text className="text-gray-500 text-[10px] font-bold mb-1">{label}</Text>
            <Text className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</Text>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
                {/* Header */}
                <View className="flex-row justify-between items-center mb-8">
                    <View>
                        <Text className="text-gray-400 font-bold text-xs tracking-widest uppercase">Admin Panel</Text>
                        <Text className="text-3xl font-black text-[#1E293B]">Dashboard</Text>
                    </View>
                    <TouchableOpacity 
                        className="bg-white p-3 rounded-full shadow-sm border border-gray-100"
                        onPress={() => router.back()}
                    >
                        <LogOut size={20} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Stats Grid */}
                <View className="flex-row mb-8 -mx-1">
                    <StatMiniCard label="TOTAL PRODUCTS" value={stats.totalProducts} color="text-blue-600" />
                    <StatMiniCard label="UNVERIFIED" value={stats.unverifiedCount} color="text-amber-500" />
                    <StatMiniCard label="CATEGORIES" value={stats.activeCategories} color="text-indigo-600" />
                </View>

                {/* Main Menu */}
                <Text className="text-[#64748B] font-bold text-sm mb-4 ml-1">Main Actions</Text>
                
                <MenuCard 
                    title="Bulk Import"
                    subtitle="CSVデータの解析・一括登録"
                    icon={Upload}
                    color="bg-blue-600"
                    onPress={() => router.push('/mng-panel-x9/import')}
                />

                <MenuCard 
                    title="Product List"
                    subtitle="登録商品の検索・管理"
                    icon={Package}
                    color="bg-indigo-600"
                    onPress={() => router.push('/mng-panel-x9/products')}
                    badge={stats.unverifiedCount > 0 ? stats.unverifiedCount : null}
                />

                <MenuCard 
                    title="Category Map"
                    subtitle="分類アルゴリズムの設定"
                    icon={BarChart3}
                    color="bg-emerald-600"
                    onPress={() => {}}
                />

                {/* Database Health Section */}
                <View className="mt-6 bg-[#1E293B] p-6 rounded-3xl">
                   <View className="flex-row items-center mb-4">
                        <Database size={20} color="#94A3B8" className="mr-2" />
                        <Text className="text-white font-bold text-lg ml-2">System Database</Text>
                   </View>
                   <Text className="text-gray-400 text-sm mb-6">
                       ローカルスクリプトによるチャージが完了しています。
                       現在 {stats.totalProducts.toLocaleString()} 件のデータが稼働中です。
                   </Text>
                   <TouchableOpacity 
                        className="bg-white/10 p-4 rounded-2xl items-center border border-white/10"
                        onPress={() => fetchStats()}
                   >
                        <Text className="text-white font-bold">Refresh Status</Text>
                   </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
