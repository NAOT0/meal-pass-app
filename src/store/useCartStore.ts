import { create } from 'zustand';
import { Database } from '../types/schema';

type Product = Database['public']['Tables']['products']['Row'];

interface CartState {
  currentList: Product[];
  lockedIds: Set<string>;
  quantities: Record<string, number>;
  budget: number;
  products: Product[];
  filters: Record<number, boolean>;
  
  // Actions
  setProducts: (items: Product[]) => void;
  setFilters: (filters: Record<number, boolean>) => void;
  setBudget: (amount: number) => void;
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

  setProducts: (items) => set({ products: items }),
  setFilters: (filters) => set({ filters: filters }),
  setBudget: (amount) => set({ budget: amount }),
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
    const { products, budget, filters } = state;
    // 1. Remove from locked
    const nextLocked = new Set(state.lockedIds);
    nextLocked.delete(productId);

    // 2. Remove from quantities
    const nextQuantities = { ...state.quantities };
    delete nextQuantities[productId];

    // 3. Remove from list and try to refill
    let nextList = state.currentList.filter(p => p.id !== productId);
    
    let currentTotal = 0;
    nextList.forEach(item => {
        const qty = nextQuantities[item.id] || 1;
        currentTotal += item.price * qty;
    });
    
    let gap = (budget || 0) - currentTotal;
    let attempts = 0;
    while (gap > 0 && attempts < 15) { // Increased attempts for better refill
        attempts++;
        const candidatePool = products.filter(p => 
            !nextList.find(existing => existing.id === p.id) && 
            p.id !== productId && 
            p.price <= gap && p.price > 0
        );
        const preferredPool = candidatePool.filter(p => p.category_id && filters[p.category_id]);
        const finalPool = preferredPool.length > 0 ? preferredPool : candidatePool;

        if (finalPool.length > 0) {
            const randomItem = finalPool[Math.floor(Math.random() * finalPool.length)];
            nextList = [...nextList, randomItem];
            nextQuantities[randomItem.id] = 1;
            gap -= randomItem.price;
        } else break;
    }

    return {
        currentList: nextList,
        lockedIds: nextLocked,
        quantities: nextQuantities
    };
  }),
}));
