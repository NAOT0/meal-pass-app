const fetch = require('node-fetch');

const URL = 'https://flvivdgfwkpofscuiovs.supabase.co';
const KEY = 'sb_publishable_MCGmgW-fZ6IhlJ0bQCZANw_BeilnBZ_';

async function findOrphans() {
    console.log('--- Checking for Products without Barcodes ---');
    
    // Get all products and their barcodes via RPC or subselect
    // Actually, let's just use the query from the app
    const res = await fetch(`${URL}/rest/v1/products?select=id,name,product_barcodes(jan_code)&limit=500`, {
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`
        }
    });

    if (!res.ok) {
        console.error('Fetch failed:', await res.text());
        return;
    }

    const products = await res.json();
    const orphans = products.filter(p => !p.product_barcodes || p.product_barcodes.length === 0);

    console.log(`Checked ${products.length} products.`);
    console.log(`Found ${orphans.length} products with NO barcode.`);
    
    if (orphans.length > 0) {
        console.log('Sample orphans:', JSON.stringify(orphans.slice(0, 5), null, 2));
    }
}

findOrphans();
