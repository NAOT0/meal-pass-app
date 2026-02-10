import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { signInWithEmail } from '../src/lib/auth';
import { Mail, Lock, ArrowLeft, ShieldCheck } from 'lucide-react-native';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('エラー', 'メールアドレスとパスワードを入力してください');
            return;
        }

        setIsLoading(true);
        const { error } = await signInWithEmail(email, password);
        setIsLoading(false);

        if (error) {
            Alert.alert('ログイン失敗', 'メールアドレスまたはパスワードが正しくありません');
        } else {
            // Success
            router.replace('/mng-panel-x9');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 px-8 justify-center"
            >
                {/* Back Button */}
                <TouchableOpacity 
                    onPress={() => router.back()}
                    className="absolute top-12 left-6 w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100"
                >
                    <ArrowLeft size={24} color="#1E293B" />
                </TouchableOpacity>

                {/* Header Section */}
                <View className="items-center mb-12">
                    <View className="bg-blue-600 w-20 h-20 rounded-[28px] items-center justify-center mb-6 shadow-xl shadow-blue-200">
                        <ShieldCheck size={40} color="white" />
                    </View>
                    <Text className="text-3xl font-black text-[#1E293B]">管理者ログイン</Text>
                    <Text className="text-gray-400 mt-2 font-medium">管理用アカウントでログインしてください</Text>
                </View>

                {/* Input Section */}
                <View className="gap-5">
                    <View>
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 mb-2">Email Address</Text>
                        <View className="bg-gray-50 flex-row items-center px-5 py-4 rounded-2xl border border-gray-100">
                            <Mail size={20} color="#94A3B8" />
                            <TextInput 
                                className="flex-1 ml-4 text-[#1E293B] font-bold text-base"
                                placeholder="admin@example.com"
                                placeholderTextColor="#CBD5E1"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                    </View>

                    <View>
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 mb-2">Password</Text>
                        <View className="bg-gray-50 flex-row items-center px-5 py-4 rounded-2xl border border-gray-100">
                            <Lock size={20} color="#94A3B8" />
                            <TextInput 
                                className="flex-1 ml-4 text-[#1E293B] font-bold text-base"
                                placeholder="••••••••"
                                placeholderTextColor="#CBD5E1"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={handleLogin}
                        disabled={isLoading}
                        activeOpacity={0.8}
                        className={`mt-4 py-5 rounded-[20px] items-center shadow-lg ${isLoading ? 'bg-gray-400' : 'bg-[#1E293B] shadow-gray-300'}`}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-black text-lg">ログイン</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer Link */}
                <View className="mt-10 items-center">
                    <Text className="text-gray-400 text-sm">
                        一般ユーザーの方はご利用いただけません
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
