import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // 1. Đọc Set index
    let ids = await kv.smembers('account_ids');

    // 2. FALLBACK: Nếu Set rỗng → scan kv.keys()
    if (!ids || ids.length === 0) {
      const keys = await kv.keys('account_*');
      if (keys && keys.length > 0) {
        ids = keys.map(k => k.replace('account_', ''));
        
        // Rebuild Set TUẦN TỰ (tránh lỗi spread quá nhiều args)
        for (const id of ids) {
          await kv.sadd('account_ids', id);
        }
        console.log(`[DATA] Rebuilt index for ${ids.length} accounts`);
      }
    }

    if (!ids || ids.length === 0) {
      return res.status(200).json({});
    }

    // 3. Lấy data song song
    const dataKeys = ids.map(id => `account_${id}`);
    const values = await Promise.all(dataKeys.map(k => kv.get(k)));

    // 4. Build response + log để debug
    const accounts = {};
    const deadIds = [];

    values.forEach((data, i) => {
      if (data) {
        accounts[ids[i]] = data;
      } else {
        deadIds.push(ids[i]);
      }
    });

    console.log(`[DATA] Returned ${Object.keys(accounts).length} accounts, ${deadIds.length} dead`);

    // 5. Cleanup ID chết (chạy tuần tự)
    if (deadIds.length > 0) {
      for (const id of deadIds) {
        kv.srem('account_ids', id).catch(() => {});
      }
    }

    return res.status(200).json(accounts);
  } catch (err) {
    console.error('[DATA ERROR]', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}
