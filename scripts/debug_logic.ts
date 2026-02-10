import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Mock Logic (Copy-pasted partly from logic.ts for standalone test)
const CATEGORY_IDS = {
  BENTO: 1, DRINK: 2, SNACK: 3, DELI: 6, NOODLE: 7, ONIGIRI: 8, BREAD: 9,
};

const fillBudget = (
  allProducts: any[],
  currentItems: any[],
  lockedItemIds: Set<string>,
  totalBudget: number,
  allowedCategoryIds: Set<number> | null = null
) => {
  const lockedItems = currentItems.filter(p => lockedItemIds.has(p.id));
  let currentTotal = lockedItems.reduce((sum, item) => sum + item.price, 0);
  let remainingBudget = totalBudget - currentTotal;

  console.log(`[Logic] Budget: ${totalBudget}, Locked: ${currentTotal}, Remaining: ${remainingBudget}`);

  const counts: any = { 1:0, 2:0, 3:0, 6:0, 7:0, 8:0, 9:0 };
  lockedItems.forEach(p => {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  });
  console.log(`[Logic] Current Counts:`, counts);

  const canAdd = (p: any, currentCounts: any): boolean => {
    if (!p.category_id) return true;
    const cid = p.category_id;
    const count = currentCounts[cid] || 0;
    
    // Constraints
    if (cid === 1 && count >= 1) return false; 
    if (cid === 7 && count >= 1) return false;
    if (cid === 8 && count >= 2) return false;
    if (cid === 2 && count >= 1) return false;
    if (cid === 3 && count >= 2) return false;
    
    return true;
  };

  const candidates = allProducts.filter(p => {
    if (!p.is_active || lockedItemIds.has(p.id)) return false;
    if (allowedCategoryIds && p.category_id && !allowedCategoryIds.has(p.category_id)) return false;
    return true;
  });
  
  console.log(`[Logic] Candidates Count: ${candidates.length}`);
  
  // Try to find ANY item that fits
  const validCandidates = candidates.filter(p => p.price <= remainingBudget && canAdd(p, counts));
  console.log(`[Logic] Valid Candidates (Price <= ${remainingBudget} & Constraints): ${validCandidates.length}`);
  
  if (validCandidates.length > 0) {
      console.log('Sample Valid Candidate:', validCandidates[0].name, validCandidates[0].price, validCandidates[0].category_id);
  } else {
      console.log('No valid candidates found! Checking why...');
      // Sample failure check
      const sample = candidates[0];
      if (sample) {
          console.log(`Sample Fail: ${sample.name} (${sample.price}yen, Cat:${sample.category_id})`);
          console.log(`- Price OK? ${sample.price <= remainingBudget}`);
          console.log(`- Constraints OK? ${canAdd(sample, counts)}`);
      }
  }

  return { list: [], total: 0 };
};

async function run() {
    console.log('Fetching products...');
    const now = new Date().toISOString();
    // Use the exact query from index.tsx
    const { data: products, error } = await supabase
      .from('products')
      .select('*, categories(*)')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (error) {
        console.error('Fetch Error:', error);
        return;
    }
    console.log(`Fetched ${products?.length} products.`);

    if (!products || products.length === 0) return;

    // Diagnose Category Distribution
    const catCounts: Record<string, number> = {};
    products.forEach(p => {
        const cid = p.category_id || 'null';
        catCounts[cid] = (catCounts[cid] || 0) + 1;
    });
    console.log('[Debug] Category Distribution in DB:', catCounts);

    // Simulate User Scenario
    // Locked Item: "クリスプチョコ" (Try to find it)
    const lockedItem = products.find(p => p.name.includes('クリスプ') || p.name.includes('チョコ'));
    if (!lockedItem) {
        console.log('Could not find locked item mock. Using random snack.');
    } else {
        console.log(`[Debug] Locked Item Found: ${lockedItem.name}, ID: ${lockedItem.id}, Category: ${lockedItem.category_id}`);
    }
    const currentList = lockedItem ? [lockedItem] : [];
    const lockedIds = new Set(currentList.map(p => p.id));
    
    const budget = 1111;
    const filters = new Set([1,2,3,6,7,8,9]); // All enabled

    fillBudget(products, currentList, lockedIds, budget, filters);
}

run();
