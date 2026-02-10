import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- LOGIC COPY ---
const CATEGORY_IDS = { BENTO: 1, DRINK: 2, SNACK: 3, DELI: 6, NOODLE: 7, ONIGIRI: 8, BREAD: 9 };
const CAT_BENTO = 1, CAT_NOODLE = 7, CAT_ONIGIRI = 8, CAT_DRINK = 2, CAT_BREAD = 9;

const fillBudget = (allProducts, currentItems, lockedItemIds, totalBudget, allowedCategoryIds) => {
  const lockedItems = currentItems.filter(p => lockedItemIds.has(p.id));
  let currentTotal = lockedItems.reduce((sum, item) => sum + item.price, 0);
  let remainingBudget = totalBudget - currentTotal;
  const counts = { [CAT_BENTO]: 0, [CAT_DRINK]: 0, [6]: 0, [CAT_NOODLE]: 0, [CAT_ONIGIRI]: 0, [3]: 0, [CAT_BREAD]: 0 };
  lockedItems.forEach(p => { if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1; });

  const canAdd = (p, currentCounts) => {
    if (!p.category_id) return true;
    const cid = p.category_id, count = currentCounts[cid] || 0;
    if (cid === CAT_BENTO && count >= 1) return false;
    if (cid === CAT_NOODLE && count >= 1) return false;
    if (cid === CAT_ONIGIRI && count >= 2) return false;
    if (cid === CAT_DRINK && count >= 1) return false;
    if (cid === 3 && count >= 2) return false;
    return true;
  };

  const candidates = allProducts.filter(p => {
    if (!p.is_active || lockedItemIds.has(p.id)) return false;
    if (allowedCategoryIds) {
       if (!p.category_id) return false;
       if (!allowedCategoryIds.has(p.category_id)) return false;
    }
    return true;
  });

  const recommended = candidates.filter(p => p.is_recommended);
  const others = candidates.filter(p => !p.is_recommended).filter(p => p.category_id !== CAT_BENTO && p.category_id !== CAT_NOODLE);
  const sortedCandidates = [...recommended, ...others];

  const newItems = [];
  for (const product of sortedCandidates) {
    if (product.price <= remainingBudget && canAdd(product, counts)) {
      newItems.push(product);
      remainingBudget -= product.price;
      currentTotal += product.price;
      if (product.category_id) counts[product.category_id] = (counts[product.category_id] || 0) + 1;
    }
    if (remainingBudget < 50) break;
  }
  return { list: [...lockedItems, ...newItems], total: currentTotal };
};

// --- RUN TEST ---
async function reproduce() {
    console.log('--- REPRODUCE ISSUE ---');
    const now = new Date().toISOString();
    const { data: products } = await supabase.from('products').select('*').eq('is_active', true);

    if (!products) return;

    const recInFetch = products.filter(p => (p as any).is_recommended);
    console.log(`Fetched ${products.length} products. Recommended in Fetch: ${recInFetch.length}`);

    const budgetNum = 2000;
    const allowedIds = new Set([1, 2, 3, 6, 7, 8, 9]);

    const result = fillBudget(products, [], new Set(), budgetNum, allowedIds);
    console.log('Result List Length:', result.list.length);
    const recInResult = result.list.filter(p => (p as any).is_recommended);
    console.log('Recommended in Result:', recInResult.length);
    
    if (recInResult.length > 0) {
        console.log('SUCCESS: Recommended items are picked.');
        console.log('Picked Rec Items:', recInResult.map(p => p.name).join(', '));
    } else {
        console.log('FAILED: No recommended items picked.');
        const recInCandidates = products.filter(p => p.is_active && p.is_recommended && p.category_id && allowedIds.has(p.category_id));
        console.log('Recommended in Candidates (Manual Check):', recInCandidates.length);
        if (recInCandidates.length > 0) {
            console.log('Sample Rec Candidate:', recInCandidates[0].name, 'Price:', recInCandidates[0].price, 'Cat:', recInCandidates[0].category_id);
            console.log('Remaining Budget:', budgetNum);
        }
    }
}

reproduce();
