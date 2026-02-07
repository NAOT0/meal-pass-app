import { Database } from '../../types/schema';

type Product = Database['public']['Tables']['products']['Row'] & {
  category?: Database['public']['Tables']['categories']['Row'] | null;
};

// Export Category IDs for UI
// Export Category IDs for UI
export const CATEGORY_IDS = {
  BENTO: 1,
  DRINK: 2,
  SNACK: 3,
  DELI: 6,
  NOODLE: 7,
  ONIGIRI: 8,
  BREAD: 9,
  SALAD: 6, // Mapped to Deli
  DESSERT: 3, // Mapped to Snack
  OTHERS: 5,
};

export const CATEGORY_LABELS = {
  BENTO: '弁当・丼',
  DRINK: '飲料',
  SNACK: 'お菓子・デザート',
  DELI: '惣菜',
  NOODLE: '麺類',
  ONIGIRI: 'おにぎり',
  BREAD: 'パン',
};

// Category IDs (Private use for constraints logic)
const CAT_BENTO   = CATEGORY_IDS.BENTO;
const CAT_DRINK   = CATEGORY_IDS.DRINK;
const CAT_DELI    = CATEGORY_IDS.DELI;
const CAT_NOODLE  = CATEGORY_IDS.NOODLE;
const CAT_ONIGIRI = CATEGORY_IDS.ONIGIRI;
const CAT_BREAD   = CATEGORY_IDS.BREAD;

interface CategoryCounts {
  [key: number]: number;
}

export const fillBudget = (
  allProducts: Product[],
  currentItems: Product[],
  lockedItemIds: Set<string>,
  totalBudget: number,
  allowedCategoryIds: Set<number> | null = null
): { list: Product[], total: number } => {
  // 1. ロック済み商品を確保
  const lockedItems = currentItems.filter(p => lockedItemIds.has(p.id));
  let currentTotal = lockedItems.reduce((sum, item) => sum + item.price, 0);
  let remainingBudget = totalBudget - currentTotal;

  // もし予算オーバー or ゼロなら即返却 (ただし負になってもロック商品は維持)
  if (remainingBudget <= 0) {
    return { list: lockedItems, total: currentTotal };
  }

  // 現在のカテゴリ別個数をカウント (ロック済み)
  const counts: CategoryCounts = {
    [CAT_BENTO]: 0, [CAT_DRINK]: 0, [CAT_DELI]: 0, 
    [CAT_NOODLE]: 0, [CAT_ONIGIRI]: 0, [CATEGORY_IDS.SNACK]: 0
  };
  
  lockedItems.forEach(p => {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  });

  // 制約チェッカー
  const canAdd = (p: Product, currentCounts: CategoryCounts): boolean => {
    if (!p.category_id) return true; // カテゴリなしは一旦許可
    
    const cid = p.category_id;
    const count = currentCounts[cid] || 0;

    // Constraints setup
    if (cid === CAT_BENTO && count >= 1) return false;      // 弁当 Max 1
    if (cid === CAT_NOODLE && count >= 1) return false;     // 麺 Max 1
    if (cid === CAT_ONIGIRI && count >= 2) return false;    // おにぎり Max 2
    if (cid === CAT_DRINK && count >= 1) return false;      // ドリンク Max 1
    if (cid === CATEGORY_IDS.SNACK && count >= 2) return false; // お菓子・デザート 合計 Max 2 (統合されたため)
    
    return true;
  };

  // 2. 候補リスト作成
  // ロックされていない、かつActiveな商品
  const candidates = allProducts.filter(p => {
    if (!p.is_active || lockedItemIds.has(p.id)) return false;
    
    // カテゴリフィルター (nullなら全許可)
    if (allowedCategoryIds) {
       // Strict Mode: If filters are active, exclude items without category
       if (!p.category_id) return false;
       if (!allowedCategoryIds.has(p.category_id)) return false;
    }
    return true;
  });

  // 3. 優先順位付けとシャッフル
  // Group 1: Recommended (True) -> Shuffle
  // Group 2: Others (False) -> Shuffle
  const recommended = candidates.filter(p => p.is_recommended).sort(() => 0.5 - Math.random());
  const others = candidates.filter(p => !p.is_recommended).sort(() => 0.5 - Math.random());

  // 結合: Recommendedが先
  const sortedCandidates = [...recommended, ...others];

  const newItems: Product[] = [];

  // 4. Greedy Selection with Constraints
  for (const product of sortedCandidates) {
    // 予算チェック
    if (product.price > remainingBudget) continue;

    // 制約チェック
    if (canAdd(product, counts)) {
      // 追加採用
      newItems.push(product);
      remainingBudget -= product.price;
      currentTotal += product.price;
      
      // カウント更新
      if (product.category_id) {
        counts[product.category_id] = (counts[product.category_id] || 0) + 1;
      }
    }

    if (remainingBudget < 50) break; // End if budget is tight
  }

  return {
    list: [...lockedItems, ...newItems],
    total: currentTotal
  };
};
