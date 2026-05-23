import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const ids = await kv.smembers('account_ids');
    if (!ids || ids.length === 0) return res.status(200).json({});

    const noteKeys = ids.map(id => `note_${id}`);
    const values = await Promise.all(noteKeys.map(k => kv.get(k)));

    const notes = {};
    ids.forEach((id, i) => {
      notes[id] = values[i] || '';
    });

    return res.status(200).json(notes);
  } catch (err) {
    return res.status(500).json({});
  }
}
