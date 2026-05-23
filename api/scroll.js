
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { userid, materials, note } = req.body;
      if (!userid) return res.status(400).send('Missing userid');
      
      await kv.set(`scroll_${userid}`, {
        userid,
        materials: materials || {},
        note: note || '',
        lastUpdate: new Date().toLocaleString('vi-VN')
      }, { ex: 7200 });
      
      return res.status(200).send('OK');
    } catch (e) {
      return res.status(500).send('Error');
    }
  }
  
  if (req.method === 'GET') {
    const { userid } = req.query;
    if (userid) {
      const data = await kv.get(`scroll_${userid}`);
      return res.status(200).json(data || {});
    }
    // Lấy all
    const ids = await kv.smembers('account_ids');
    if (!ids || ids.length === 0) return res.status(200).json({});
    
    const values = await Promise.all(ids.map(id => kv.get(`scroll_${id}`)));
    const result = {};
    values.forEach((v, i) => { if (v) result[ids[i]] = v; });
    return res.status(200).json(result);
  }
  
  return res.status(405).send('Method not allowed');
}
