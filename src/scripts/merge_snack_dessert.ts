
import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Merging Dessert (ID 4) into Snack (ID 3)...');

  // 1. Update products
  console.log('Updating products table...');
  const { error: productError } = await supabase
    .from('products')
    .update({ category_id: 3 })
    .eq('category_id', 4);

  if (productError) {
    console.error('Error updating products:', productError);
  } else {
    console.log('Products updated successfully.');
  }

  // 2. Update classification_votes
  console.log('Updating classification_votes table...');
  const { error: voteError } = await supabase
    .from('classification_votes')
    .update({ voted_category_id: 3 })
    .eq('voted_category_id', 4);

  if (voteError) {
    console.error('Error updating votes:', voteError);
  } else {
    console.log('Votes updated successfully.');
  }

  // 3. Rename Category ID 3
  console.log('Renaming Category ID 3 to "お菓子・デザート"...');
  const { error: renameError } = await supabase
    .from('categories')
    .update({ name: 'お菓子・デザート', slug: 'snack_dessert' })
    .eq('id', 3);

  if (renameError) {
    console.error('Error renaming category:', renameError);
  } else {
    console.log('Category renamed successfully.');
  }

  // 4. Delete Category ID 4
  console.log('Deleting Category ID 4 (Dessert)...');
  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('id', 4);

  if (deleteError) {
    console.warn('Warning: Could not delete category 4 (might have remaining refs):', deleteError.message);
  } else {
    console.log('Category 4 deleted successfully.');
  }

  console.log('Migration completed.');
}

main();
