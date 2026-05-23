import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { userid } = req.query;
  if (!userid) return res.status(400).json({ error: 'Thiếu userid' });

  const noteKey = `note_${userid}`;

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const safeNote = String(body?.note || '').slice(0, 100);
    await kv.set(noteKey, safeNote);
    return res.status(200).json({ message: 'Đã lưu ghi chú!' });
  }

  if (req.method === 'GET') {
    const note = await kv.get(noteKey);
    return res.status(200).json({ note: note || '' });
  }

  return res.status(405).send('Method not allowed');
}
