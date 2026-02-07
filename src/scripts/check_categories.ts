
import { supabase } from '../src/lib/supabase';

async function check() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, category_id');

  if (error) {
    console.error(error);
    return;
  }

  const counts: Record<number, number> = {};
  const sample: Record<number, string[]> = {};

  products.forEach(p => {
    const cid = p.category_id || 0;
    counts[cid] = (counts[cid] || 0) + 1;
    if (!sample[cid]) sample[cid] = [];
    if (sample[cid].length < 3) sample[cid].push(p.name);
  });

  console.log('Category Counts:', counts);
  console.log('Samples:', JSON.stringify(sample, null, 2));
}

check();
