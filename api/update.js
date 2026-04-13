import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const stats = req.body;
    stats.lastUpdate = new Date().toLocaleString('vi-VN');
    
    await kv.set('atlantis_stats', stats, { ex: 3600 }); // Lưu 1 giờ
    
    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send('Error');
  }
}
