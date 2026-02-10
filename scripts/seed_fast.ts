
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

interface ImportItem {
    janCode: string;
    name: string;
    price: number;
    categoryId: number | null;
}

const CATEGORY_IDS = {
    BENTO: 1,
    DRINK: 2,
    SNACK: 3,
    DESSERT: 4,
    UNKNOWN: 5,
    DELI: 6,
    NOODLE: 7,
    ONIGIRI: 8
};

const getCategoryId = (catName: string): number => {
    if (!catName) return CATEGORY_IDS.UNKNOWN;
    if (catName.includes('おにぎり')) return CATEGORY_IDS.ONIGIRI;
    if (catName.includes('サラダ')) return CATEGORY_IDS.DELI;
    if (catName.includes('パスタ') || catName.includes('麺')) return CATEGORY_IDS.NOODLE;
    if (catName.includes('飲み物') || catName.includes('ドリンク')) return CATEGORY_IDS.DRINK;
    if (catName.includes('パン') || catName.includes('サンド')) return CATEGORY_IDS.SNACK;
    if (catName.includes('デザート') || catName.includes('スイーツ')) return CATEGORY_IDS.DESSERT;
    return CATEGORY_IDS.BENTO;
};

async function main() {
    const csvPath = path.resolve(__dirname, '../meal-menu.csv');
    
    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found:', csvPath);
        process.exit(1);
    }

    console.log(`Reading ${csvPath}...`);
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let batch: ImportItem[] = [];
    const BATCH_SIZE = 100;
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        
        const parts = line.split(/[,\t;]/).map(s => s.trim().replace(/^["']|["']$/g, ''));
        if (parts.length < 2) continue;

        const jan = parts[0].replace(/[^0-9]/g, '');
        if (jan.length !== 8 && jan.length !== 13) continue;

        const name = (parts[3] || '不明').replace(/^\*/, '');
        const price = parseInt(parts[5] || '0', 10) || 0;
        const catName = parts[1] || '';
        const catId = getCategoryId(catName);

        batch.push({
            janCode: jan,
            name: name,
            price: price,
            categoryId: catId
        });

        if (batch.length >= BATCH_SIZE) {
            await processBatch(batch);
            totalProcessed += batch.length;
            batch = [];
            process.stdout.write(`\rProcessed: ${totalProcessed} (Success: ${successCount}, Error: ${errorCount})`);
        }
    }

    if (batch.length > 0) {
        await processBatch(batch);
        totalProcessed += batch.length;
        process.stdout.write(`\rProcessed: ${totalProcessed} (Success: ${successCount}, Error: ${errorCount})`);
    }

    console.log('\nDone!');

    async function processBatch(items: ImportItem[]) {
        try {
            const { data, error } = await supabase.rpc('bulk_import_v3', { 
                items: items,
                expires_at_val: null 
            });

            if (error) {
                console.error('\nBatch Error:', error.message);
                console.error('Details:', error.details, error.hint);
                errorCount += items.length;
                process.exit(1); // Stop on first error to debug
            } else {
                const res = data as { success: number, error: number, debug_last_error?: string };
                if (res.error > 0 && res.success === 0) {
                     console.error('RPC Internal Error:', res.debug_last_error);
                     process.exit(1);
                }
                successCount += res.success;
                errorCount += res.error;
            }
        } catch (e) {
            errorCount += items.length;
        }
    }
}

main().catch(console.error);
