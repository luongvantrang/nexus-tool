import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const stats = req.body;

    // Validate
    if (!stats || !stats.userid) {
      return res.status(400).send('Missing userid');
    }

    const userid = String(stats.userid);
    const key = `account_${userid}`;

    // Thêm timestamp
    stats.lastUpdate = new Date().toLocaleString('vi-VN');
    stats.lastRaw    = new Date().toISOString();

    // Lưu data + add vào Set index (song song cho nhanh)
    await Promise.all([
      kv.set(key, stats, { ex: 7200 }),       // Data hết hạn sau 2h
      kv.sadd('account_ids', userid)           // Index không hết hạn
    ]);

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[UPDATE ERROR]', err);
    return res.status(500).send('Error');
  }
}
