import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const stats = req.body;
    if (!stats || !stats.userid) return res.status(400).send('Missing userid');

    const key = `account_${stats.userid}`;
    stats.lastUpdate = new Date().toLocaleString('vi-VN');
    stats.lastRaw    = new Date().toISOString();

    // Lưu data + thêm vào Set index để query nhanh
    await Promise.all([
      kv.set(key, stats, { ex: 7200 }),
      kv.sadd('account_ids', stats.userid.toString())
    ]);

    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
}
