const fetch = require('node-fetch');

const URL = 'https://flvivdgfwkpofscuiovs.supabase.co';
const KEY = 'sb_publishable_MCGmgW-fZ6IhlJ0bQCZANw_BeilnBZ_';

async function countAll() {
    console.log('--- Final Database Audit ---');
    
    // Count Products
    const pRes = await fetch(`${URL}/rest/v1/products?select=id`, {
        headers: {
            'apikey': KEY,
            'Prefer': 'count=exact'
        }
    });
    const pCount = pRes.headers.get('content-range')?.split('/')[1];

    // Count Barcodes
    const bRes = await fetch(`${URL}/rest/v1/product_barcodes?select=jan_code`, {
        headers: {
            'apikey': KEY,
            'Prefer': 'count=exact'
        }
    });
    const bCount = bRes.headers.get('content-range')?.split('/')[1];

    // Count Barcodes with NULL product_id
    const nRes = await fetch(`${URL}/rest/v1/product_barcodes?product_id=is.null&select=jan_code`, {
        headers: {
            'apikey': KEY,
            'Prefer': 'count=exact'
        }
    });
    const nCount = nRes.headers.get('content-range')?.split('/')[1];

    console.log(`Total Products: ${pCount}`);
    console.log(`Total Barcodes: ${bCount}`);
    console.log(`Barcodes with NULL Product ID: ${nCount}`);

    // Check if some products have multiple barcodes
    const multRes = await fetch(`${URL}/rest/v1/product_barcodes?select=product_id`, {
        headers: {
            'apikey': KEY
        }
    });
    const allBarcodes = await multRes.json();
    const idFreq = {};
    allBarcodes.forEach(b => {
        idFreq[b.product_id] = (idFreq[b.product_id] || 0) + 1;
    });
    const multiples = Object.values(idFreq).filter(v => v > 1).length;
    console.log(`Products with multiple barcodes: ${multiples}`);
}

countAll();
