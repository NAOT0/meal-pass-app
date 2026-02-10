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

async function check() {
    console.log('--- DIAGNOSTIC START ---');
    
    // 1. Check Categories Access
    console.log('Checking Categories...');
    const { data: cats, error: catError } = await supabase.from('categories').select('*');
    if (catError) console.error('Categories Error:', catError.message);
    else console.log(`Categories found: ${cats?.length}`);

    // 2. Check Products Access (Raw)
    console.log('Checking Products (Simple)...');
    const { count: prodCount, error: prodError } = await supabase.from('products').select('*', { count: 'exact', head: true });
    if (prodError) console.error('Products Head Error:', prodError.message);
    else console.log(`Total Products Count: ${prodCount}`);

    // 3. Check Products with Filter (App Logic)
    console.log('Checking Products (With App Filters)...');
    const now = new Date().toISOString();
    const { data: filtered, error: filterError } = await supabase
        .from('products')
        .select('name, price, category_id')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .limit(5);

    if (filterError) console.error('Filtered Query Error:', filterError.message);
    else {
        console.log(`Filtered Items returned: ${filtered?.length}`);
        if(filtered && filtered.length > 0) console.log('Sample:', filtered[0]);
    }

    console.log('--- DIAGNOSTIC END ---');
}

check();
