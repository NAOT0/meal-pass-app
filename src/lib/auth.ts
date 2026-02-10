import { supabase } from './supabase';

export const signInAnonymously = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return;
    }

    if (!session) {
      const { error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        console.error('Error signing in anonymously:', signInError);
      } else {
        console.log('Signed in anonymously');
      }
    } else {
      console.log('Session exists user:', session.user.id);
    }
  } catch (e) {
    console.error('Auth error:', e);
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};
