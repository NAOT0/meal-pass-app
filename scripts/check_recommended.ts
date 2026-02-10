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

async function check() {
    console.log('--- Recommended Products DB Check ---');
    const { data, error } = await supabase
        .from('products')
        .select('id, name, is_recommended, is_active, expires_at, category_id')
        .eq('is_recommended', true);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log(`Found ${data?.length || 0} recommended items in DB.`);
    
    if (data && data.length > 0) {
        data.forEach(p => {
            console.log(`- [${p.id}] ${p.name}: Active=${p.is_active}, Expiry=${p.expires_at}, Cat=${p.category_id}`);
        });
    }

    // Also check total active products
    const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
    
    console.log(`\nTotal Active Products in DB: ${count}`);
}

check();
