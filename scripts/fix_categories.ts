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

const CATEGORY_IDS = {
    BENTO: 1,
    DRINK: 2,
    SNACK: 3,
    DESSERT: 4, // Mapped to Snack in app usually, but DB has 4
    UNKNOWN: 5,
    DELI: 6,
    NOODLE: 7,
    ONIGIRI: 8,
    BREAD: 9
};

const RULES = [
    { id: CATEGORY_IDS.ONIGIRI, keywords: ['おにぎり', '手巻', 'おむすび', '赤飯'] },
    { id: CATEGORY_IDS.BREAD, keywords: ['パン', 'サンド', 'バーガー', 'ドッグ', 'マフィン', 'デニッシュ', 'トースト'] },
    { id: CATEGORY_IDS.NOODLE, keywords: ['うどん', 'そば', 'ラーメン', 'パスタ', 'スパゲティ', '麺', '焼きそば', 'タンメン'] },
    { id: CATEGORY_IDS.DRINK, keywords: ['茶', '水', 'コーヒー', 'ラテ', 'ジュース', 'コーラ', 'サイダー', 'ミルク', '飲料', 'ボトル'] },
    { id: CATEGORY_IDS.SNACK, keywords: ['チョコ', 'クッキー', 'グミ', 'アイス', 'スナック', 'チップス', 'キャンディ', 'ガム', '煎餅', 'カリカリ', 'ポテト'] },
    { id: CATEGORY_IDS.DESSERT, keywords: ['プリン', 'ゼリー', 'シュークリーム', 'エクレア', 'ケーキ', 'ヨーグルト', '大福', '団子', 'タルト', 'ワッフル'] },
    { id: CATEGORY_IDS.DELI, keywords: ['サラダ', '惣菜', '煮', '焼', '揚', 'チキン', 'コロッケ', '天ぷら', 'カツ', '春巻', '餃子'] },
    { id: CATEGORY_IDS.BENTO, keywords: ['弁当', '丼', '重', 'カレー', 'ライス', 'チャーハン', 'オムライス'] }
];

async function main() {
    console.log('Starting Auto-Classification...');
    
    // 1. Fetch all products (chunked if needed, but 24k might fit in memory or stream)
    // We will do pagination to be safe
    let page = 0;
    const pageSize = 1000;
    let totalUpdated = 0;

    while (true) {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, category_id')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Fetch error:', error);
            break;
        }
        if (!products || products.length === 0) break;

        console.log(`Processing chunk ${page + 1} (${products.length} items)...`);

        const updates: { id: string, category_id: number }[] = [];

        for (const p of products) {
            let newCatId = p.category_id;
            
            // Try to match keywords
            for (const rule of RULES) {
                if (rule.keywords.some(k => p.name.includes(k))) {
                    newCatId = rule.id;
                    break;
                }
            }

            // If it changed, add to updates
            if (newCatId !== p.category_id) {
                // Determine if we should update. 
                // Currently most are 1 or 5. We should overwrite 1/5 with more specific.
                // If it was already specific (e.g. 7), and rule says 7, no change.
                // If specific (7) and rule says 1, we might keep 7? 
                // For now, simple overwrite logic: if changed, update.
                updates.push({ id: p.id, category_id: newCatId });
            }
        }

        // Apply Updates
        if (updates.length > 0) {
            // Bulk update is hard with supabase-js directly without upsert.
            // We can iterate or use upsert if we have all fields. We don't.
            // So we loop (slow but works) OR we construct a big upsert with partial data? 
            // Products table has required fields, so upsert needs them.
            // UPDATE: We do simple loop for now, or batch RPC?
            // "bulk_import" was for insert/upsert. 
            // Let's use a loop with Promise.all for speed, throttled.
            
            // Better: Upsert with just ID and CategoryID? 
            // No, unrelated columns (name, price) might be required or nulled if we don't include them.
            // Actually, an upsert on ID updates specified columns and leaves others if we map correctly?
            // Supabase upsert requires primary key match.
            // Let's try simple batched updates using a custom RPC or just loop. 
            // Loop 1000 items is slow.
            // FASTEST: Send this list to a new RPC?
            // OR, just updating one by one. 1000 items... 
            
            // Let's use `Promise.all` in chunks of 50.
            const UPDATE_CHUNK = 50;
            for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
                const chunk = updates.slice(i, i + UPDATE_CHUNK);
                await Promise.all(chunk.map(u => 
                    supabase.from('products').update({ category_id: u.category_id }).eq('id', u.id)
                ));
            }
            totalUpdated += updates.length;
            console.log(`  Updated ${updates.length} items in this chunk.`);
        }

        if (products.length < pageSize) break;
        page++;
    }

    console.log(`Finished! Total items re-classified: ${totalUpdated}`);
}

main().catch(console.error);
