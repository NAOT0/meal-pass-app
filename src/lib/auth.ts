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
