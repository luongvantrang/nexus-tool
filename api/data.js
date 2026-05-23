import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // Dùng Set index thay vì kv.keys() - nhanh hơn nhiều
    const ids = await kv.smembers('account_ids');
    
    if (!ids || ids.length === 0) {
      return res.status(200).json({});
    }

    // Lấy tất cả account song song
    const keys = ids.map(id => `account_${id}`);
    const values = await Promise.all(keys.map(k => kv.get(k)));

    const accounts = {};
    values.forEach((data, i) => {
      if (data) {
        accounts[ids[i]] = data;
      } else {
        // Cleanup: xóa ID không còn data
        kv.srem('account_ids', ids[i]);
      }
    });

    res.status(200).json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
}
