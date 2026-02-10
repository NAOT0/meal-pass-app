const fetch = require('node-fetch');

const URL = 'https://flvivdgfwkpofscuiovs.supabase.co';
const KEY = 'sb_publishable_MCGmgW-fZ6IhlJ0bQCZANw_BeilnBZ_';

async function diagnose() {
    console.log('--- Database Linkage Diagnosis ---');
    
    // 1. Get sample barcodes
    const bRes = await fetch(`${URL}/rest/v1/product_barcodes?select=*,products(name)&limit=10`, {
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`
        }
    });
    const barcodes = await bRes.json();
    console.log('Sample Barcodes with joined Products:');
    console.log(JSON.stringify(barcodes, null, 2));

    // 2. Count orphans (barcodes with no valid product)
    const orphRes = await fetch(`${URL}/rest/v1/product_barcodes?select=count`, {
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Range': '0-0'
        }
    });
    // This is a bit tricky via REST without a specific filter for null, 
    // but let's just see if the product_id is generally populated.
    
    // 3. Check total counts
    const pCountRes = await fetch(`${URL}/rest/v1/products?select=count`, { headers: { 'apikey': KEY } });
    const bCountRes = await fetch(`${URL}/rest/v1/product_barcodes?select=count`, { headers: { 'apikey': KEY } });
    
    console.log(`Total Products: ${pCountRes.headers.get('content-range')}`);
    console.log(`Total Barcodes: ${bCountRes.headers.get('content-range')}`);
}

diagnose();
