const fetch = require('node-fetch');

const URL = 'https://flvivdgfwkpofscuiovs.supabase.co';
const KEY = 'sb_publishable_MCGmgW-fZ6IhlJ0bQCZANw_BeilnBZ_';

async function checkSpecific() {
    const jan = '4901085632482';
    console.log(`Checking JAN: ${jan}...`);
    
    // 1. Get Product ID
    const bRes = await fetch(`${URL}/rest/v1/product_barcodes?jan_code=eq.${jan}&select=product_id`, {
        headers: { 'apikey': KEY }
    });
    const bData = await bRes.json();
    if (bData.length === 0) {
        console.log('Barcode not found.');
        return;
    }
    const pid = bData[0].product_id;
    console.log(`Product ID: ${pid}`);

    // 2. Get Product Info
    const pRes = await fetch(`${URL}/rest/v1/products?id=eq.${pid}&select=*,categories(name)`, {
        headers: { 'apikey': KEY }
    });
    const pData = await pRes.json();
    console.log('Product Details:', JSON.stringify(pData, null, 2));

    // 3. Check for votes
    const vRes = await fetch(`${URL}/rest/v1/classification_votes?product_id=eq.${pid}&select=*`, {
        headers: { 'apikey': KEY }
    });
    const vData = await vRes.json();
    console.log(`Active Votes: ${vData.length}`);
}

checkSpecific();
