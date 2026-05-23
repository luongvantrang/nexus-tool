import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { userid } = req.query;
  if (!userid) return res.status(400).json({ error: 'Thiếu userid' });

  const noteKey = `note_${userid}`;

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const safeNote = String(body?.note ?? '').slice(0, 100);
    await kv.set(noteKey, safeNote);
    return res.status(200).json({ success: true, note: safeNote });
  }

  if (req.method === 'GET') {
    const note = await kv.get(noteKey);
    return res.status(200).json({ note: note || '' });
  }

  return res.status(405).send('Method not allowed');
}
