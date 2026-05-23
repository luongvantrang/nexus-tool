import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { userid } = req.query;
  if (!userid) return res.status(400).json({ error: 'Thiếu userid' });

  const noteKey = `note_${userid}`;

  // POST: Lưu note
  if (req.method === 'POST') {
    const { note } = req.body || {};
    const safeNote = String(note || '').slice(0, 100);
    await kv.set(noteKey, safeNote);
    return res.status(200).json({ message: 'Đã lưu ghi chú!' });
  }

  // GET: Đọc note
  if (req.method === 'GET') {
    const note = await kv.get(noteKey);
    return res.status(200).json({ note: note || '' });
  }

  return res.status(405).send('Method not allowed');
}
