
import { supabase } from '../src/lib/supabase';

async function verify() {
  console.log('--- Database Verification ---');

  // 1. Check total unverified products
  const { count: unverifiedCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_verified', false);
  console.log(`Unverified Products: ${unverifiedCount}`);

  // 2. Check classification votes
  const { data: votes, error: voteError } = await supabase
    .from('classification_votes')
    .select('*, categories(name)')
    .limit(10);
  
  if (voteError) {
    console.error('Error fetching votes:', voteError);
  } else {
    console.log(`Recent Votes found: ${votes.length}`);
    votes.forEach(v => {
      console.log(`- Product ID: ${v.product_id}, Category ID: ${v.voted_category_id}, Created: ${v.created_at}`);
    });
  }

  // 3. Check categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*');
  console.log('Registered Categories:', categories?.map(c => `${c.name} (ID:${c.id})`).join(', '));
}

verify();
