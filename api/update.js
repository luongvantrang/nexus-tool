import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const stats = req.body;
    const key = `account_${stats.userid}`;

    stats.lastUpdate = new Date().toLocaleString('vi-VN');
    stats.lastRaw    = new Date().toISOString();

    await kv.set(key, stats, { ex: 7200 });
    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send('Error');
  }
}
