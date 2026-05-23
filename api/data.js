import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    let ids = await kv.smembers('account_ids');
    
    // Fallback: nếu Set rỗng → quét keys() và auto-build Set
    if (!ids || ids.length === 0) {
      const keys = await kv.keys('account_*');
      ids = keys.map(k => k.replace('account_', ''));
      
      // Auto rebuild Set
      if (ids.length > 0) {
        await kv.sadd('account_ids', ...ids);
      }
    }
    
    if (!ids || ids.length === 0) return res.status(200).json({});

    const keys = ids.map(id => `account_${id}`);
    const values = await Promise.all(keys.map(k => kv.get(k)));

    const accounts = {};
    values.forEach((data, i) => {
      if (data) accounts[ids[i]] = data;
    });

    res.status(200).json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
}
