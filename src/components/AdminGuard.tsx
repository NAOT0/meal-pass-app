import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Button } from './Button';
import { supabase } from '../lib/supabase';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // Check current session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('Auth event:', _event, newSession?.user?.email);
      setSession(newSession);
      if (newSession) {
        setLoading(true);
        setAdminCheckError(null);
        checkAdminStatus(newSession.user.id);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    console.log('Initial session check:', currentSession?.user?.email || 'No session');
    setSession(currentSession);
    if (currentSession) {
      await checkAdminStatus(currentSession.user.id);
    } else {
      setLoading(false);
    }
  };

  const checkAdminStatus = async (userId: string) => {
    console.log('Checking admin status for UID:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Admin check query error:', error);
        setAdminCheckError(`${error.code}: ${error.message}`);
        setIsAdmin(false);
        return;
      }
      
      console.log('Profile data retrieved:', data);
      setIsAdmin(!!data?.is_admin);
      if (!data?.is_admin) {
        setAdminCheckError('Database: is_admin is false');
      }
    } catch (err: any) {
      console.error('Admin check runtime error:', err);
      setAdminCheckError(err.message || 'Unknown runtime error');
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    setAuthLoading(true);
    setAdminCheckError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert('ログイン失敗', err.message || 'メールアドレスまたはパスワードが正しくありません');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (session && isAdmin === true) {
    return <>{children}</>;
  }

  // If loading is finished and we are NOT an admin, or we aren't logged in yet
  // We show the login form. 
  // Exception: If we ARE logged in as a real user (not anonymous) but don't have admin rights, show the Access Denied screen.
  const isAnonymous = session?.user?.is_anonymous || session?.user?.aud === 'anonymous';

  if (session && !isAnonymous && isAdmin === false) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>🚫</Text>
          <Text style={styles.title}>アクセス拒否</Text>
          <Text style={styles.subtitle}>
            管理者権限がありません。{"\n"}
            適切な権限を持つアカウントでログインしてください。
          </Text>
          
          <Button title="ログアウト" onPress={handleSignOut} className="w-full mt-4" variant="outline" />
        </View>
      </View>
    );
  }

  // Login View (Shown if not logged in, or logged in anonymously, or admin check failed)
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔐</Text>
        </View>
        <Text style={styles.title}>管理者ログイン</Text>
        <Text style={styles.subtitle}>登録された管理者用メールアドレスでログインしてください。</Text>
        
        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="パスワード"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button 
          title={authLoading ? "ログイン中..." : "ログイン"} 
          onPress={handleLogin}
          disabled={authLoading}
          className="w-full py-4 mt-2"
        />
        
        <Text style={styles.hint}>
          ※データベースのRLSにより、権限のないユーザーは操作できません
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#EFF6FF',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  hint: {
    marginTop: 24,
    fontSize: 11,
    color: '#9CA3AF',
  },
  debugBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  debugUID: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  }
});
