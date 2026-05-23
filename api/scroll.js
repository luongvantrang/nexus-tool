import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);

      const { userid, materials, note, player } = body;
      if (!userid) return res.status(400).send('Missing userid');

      await kv.set(`scroll_${userid}`, {
        userid: String(userid),
        player: player || '',
        materials: materials || {},
        note: note || '',
        lastUpdate: new Date().toLocaleString('vi-VN')
      }, { ex: 7200 });

      return res.status(200).send('OK');
    } catch (e) {
      console.error('[SCROLL ERROR]', e.message);
      return res.status(500).send('Error');
    }
  }

  if (req.method === 'GET') {
    const { userid } = req.query;
    if (userid) {
      const data = await kv.get(`scroll_${userid}`);
      return res.status(200).json(data || {});
    }
    return res.status(400).send('Missing userid');
  }

  return res.status(405).send('Method not allowed');
}
