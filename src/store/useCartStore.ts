import { create } from 'zustand';
import { Database } from '../types/schema';
import { fillBudget } from '../features/recommendation/logic';

type Product = Database['public']['Tables']['products']['Row'];

interface CartState {
  currentList: Product[];
  lockedIds: Set<string>;
  quantities: Record<string, number>;
  budget: number;
  products: Product[];
  filters: Record<number, boolean>;
  userRole: 'admin' | 'guest' | null;
  
  // Actions
  setProducts: (items: Product[]) => void;
  setFilters: (filters: Record<number, boolean>) => void;
  setBudget: (amount: number) => void;
  setUserRole: (role: 'admin' | 'guest' | null) => void;
  setCurrentList: (list: Product[]) => void;
  toggleItemLock: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  deleteItem: (productId: string) => void;
  addFromScan: (product: Product) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  currentList: [],
  lockedIds: new Set<string>(),
  quantities: {},
  budget: 0,
  products: [],
  filters: {},
  userRole: null,

  setProducts: (items) => set({ products: items }),
  setFilters: (filters) => set({ filters: filters }),
  setBudget: (amount) => set({ budget: amount }),
  setUserRole: (role) => set({ userRole: role }),
  setCurrentList: (list) => set({ currentList: list }),

  toggleItemLock: (productId) => set((state) => {
    const nextLocked = new Set(state.lockedIds);
    if (nextLocked.has(productId)) nextLocked.delete(productId);
    else nextLocked.add(productId);
    return { lockedIds: nextLocked };
  }),

  updateQuantity: (productId, delta) => set((state) => {
    const current = state.quantities[productId] || 1;
    const next = current + delta;
    if (next < 1) return state;
    return { quantities: { ...state.quantities, [productId]: next } };
  }),

  addFromScan: (product) => set((state) => {
    const isNew = !state.currentList.find(p => p.id === product.id);
    const newList = isNew ? [product, ...state.currentList] : state.currentList;
    const newQty = (state.quantities[product.id] || 0) + 1;
    const nextLocked = new Set(state.lockedIds);
    nextLocked.add(product.id);
    
    return {
      currentList: newList,
      quantities: { ...state.quantities, [product.id]: newQty },
      lockedIds: nextLocked
    };
  }),

  deleteItem: (productId) => set((state) => {
    const { products, budget, filters, quantities, lockedIds, currentList } = state;
    
    // 1. ロック解除と数量削除
    const nextLocked = new Set(lockedIds);
    nextLocked.delete(productId);

    const nextQuantities = { ...quantities };
    delete nextQuantities[productId];

    // 2. 削除対象を除いたリストを作成
    const remainingList = currentList.filter(p => p.id !== productId);
    
    // 3. fillBudget に渡すための準備
    // 有効なフィルタを Set に変換
    const allowedIds = new Set<number>();
    Object.entries(filters).forEach(([id, enabled]) => {
      if (enabled) allowedIds.add(Number(id));
    });

    // 複数個指定されている商品の「2個目以降」の金額を予算から差し引く
    // (fillBudgetは1個ずつの追加を想定しているため)
    let extraQuantityCost = 0;
    remainingList.forEach(p => {
      if (nextLocked.has(p.id)) {
        const qty = nextQuantities[p.id] || 1;
        if (qty > 1) {
          extraQuantityCost += p.price * (qty - 1);
        }
      }
    });

    const effectiveBudget = (budget || 0) - extraQuantityCost;

    // 4. ホーム画面と同じロジックで補充
    const { list } = fillBudget(
      products,
      remainingList,
      nextLocked,
      effectiveBudget,
      allowedIds
    );

    // 5. 新しく追加された商品の数量を1に設定
    const finalQuantities = { ...nextQuantities };
    list.forEach(p => {
      if (!finalQuantities[p.id]) finalQuantities[p.id] = 1;
    });

    return {
      currentList: list,
      lockedIds: nextLocked,
      quantities: finalQuantities
    };
  }),
}));
