import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useCartStore } from '../store/useCartStore';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const { userRole, setUserRole } = useCartStore();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('[AdminGuard] No session, redirecting to login');
        router.replace('/login');
        return;
      }

      // Check role if not already in store
      if (!userRole) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        const profile = data as { role: string } | null;

        if (error || !profile || profile.role !== 'admin') {
          console.log('[AdminGuard] Unauthorized role:', profile?.role);
          router.replace('/login');
          return;
        }
        
        setUserRole(profile.role as any);
      } else if (userRole !== 'admin') {
        router.replace('/login');
        return;
      }

      setChecking(false);
    } catch (err) {
      console.error('[AdminGuard] Error:', err);
      router.replace('/login');
    }
  }

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.subtitle}>認証中...</Text>
      </View>
    );
  }

  return <>{children}</>;
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
