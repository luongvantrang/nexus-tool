import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      
      const { userid, player, scrolls } = body;
      if (!userid) return res.status(400).json({ error: 'Missing userid' });

      const data = {
        userid: String(userid),
        player: player || '',
        scrolls: scrolls || {},
        lastUpdate: new Date().toLocaleString('vi-VN'),
        lastRaw: new Date().toISOString(),
      };

      await kv.set(`scrolls_${userid}`, data, { ex: 7200 });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    const { userid } = req.query;
    if (userid) {
      const data = await kv.get(`scrolls_${userid}`);
      return res.status(200).json(data || { scrolls: {} });
    }
    return res.status(400).json({ error: 'Missing userid' });
  }

  return res.status(405).send('Method not allowed');
}
