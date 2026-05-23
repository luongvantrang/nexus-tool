import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // 1. Đọc danh sách ID từ Set index (nhanh)
    let ids = await kv.smembers('account_ids');

    // 2. FALLBACK: Nếu Set rỗng → quét kv.keys() và auto-build Set
    //    (chỉ chạy 1 lần cho data cũ tồn tại trước khi update API)
    if (!ids || ids.length === 0) {
      const keys = await kv.keys('account_*');
      if (keys.length > 0) {
        ids = keys.map(k => k.replace('account_', ''));
        // Rebuild Set để lần sau dùng nhanh
        await kv.sadd('account_ids', ...ids);
        console.log(`[DATA] Auto-rebuilt index for ${ids.length} accounts`);
      }
    }

    if (!ids || ids.length === 0) {
      return res.status(200).json({});
    }

    // 3. Lấy data song song (Promise.all = nhanh hơn loop nhiều lần)
    const dataKeys = ids.map(id => `account_${id}`);
    const values = await Promise.all(dataKeys.map(k => kv.get(k)));

    // 4. Build response + cleanup ID rác (data đã hết hạn nhưng Set còn)
    const accounts = {};
    const deadIds = [];

    values.forEach((data, i) => {
      if (data) {
        accounts[ids[i]] = data;
      } else {
        deadIds.push(ids[i]);
      }
    });

    // 5. Cleanup ID chết (chạy ngầm, không block response)
    if (deadIds.length > 0) {
      kv.srem('account_ids', ...deadIds).catch(e => 
        console.error('[CLEANUP]', e)
      );
    }

    return res.status(200).json(accounts);
  } catch (err) {
    console.error('[DATA ERROR]', err);
    return res.status(500).json({});
  }
}
