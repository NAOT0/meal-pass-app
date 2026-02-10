const fetch = require('node-fetch');

const URL = 'https://flvivdgfwkpofscuiovs.supabase.co';
const KEY = 'sb_publishable_MCGmgW-fZ6IhlJ0bQCZANw_BeilnBZ_';

async function repair() {
    console.log('Checking categories...');
    
    // 1. Add Category 9 (Bread) if missing
    const res = await fetch(`${URL}/rest/v1/categories`, {
        method: 'POST',
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify([
            { id: 9, name: 'パン', slug: 'bread' }
        ])
    });

    if (res.ok) {
        console.log('Category 9 (Bread) ensured.');
    } else {
        const err = await res.text();
        console.error('Failed to add category 9:', err);
    }
}

repair();
