
import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Adding Bread category...');
  const { data, error } = await supabase
    .from('categories')
    .insert([
      { id: 9, slug: 'bread', name: 'パン', recommendation_weight: 1 }
    ])
    .select();

  if (error) {
    if (error.code === '23505') {
      console.log('Category already exists.');
    } else {
      console.error('Error adding category:', error);
    }
  } else {
    console.log('Successfully added category:', data);
  }
}

main();
