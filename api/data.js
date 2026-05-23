import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let ids = await kv.smembers('account_ids');

    if (!ids || ids.length === 0) {
      const keys = await kv.keys('account_*');
      if (keys && keys.length > 0) {
        ids = keys.map(k => k.replace('account_', ''));
        for (const id of ids) await kv.sadd('account_ids', id);
      }
    }

    if (!ids || ids.length === 0) {
      return res.status(200).json({ accounts: {}, notes: {}, scrolls: {} });
    }

    const dataKeys    = ids.map(id => `account_${id}`);
    const noteKeys    = ids.map(id => `note_${id}`);
    const scrollKeys  = ids.map(id => `scrolls_${id}`);

    const [dataValues, noteValues, scrollValues] = await Promise.all([
      Promise.all(dataKeys.map(k => kv.get(k))),
      Promise.all(noteKeys.map(k => kv.get(k))),
      Promise.all(scrollKeys.map(k => kv.get(k))),
    ]);

    const accounts = {};
    const notes    = {};
    const scrolls  = {};
    const deadIds  = [];

    ids.forEach((id, i) => {
      if (dataValues[i]) {
        accounts[id] = dataValues[i];
        notes[id]    = noteValues[i] || '';
        scrolls[id]  = scrollValues[i] || { scrolls: {} };
      } else {
        deadIds.push(id);
      }
    });

    if (deadIds.length > 0) {
      for (const id of deadIds) {
        kv.srem('account_ids', id).catch(() => {});
      }
    }

    return res.status(200).json({ accounts, notes, scrolls });
  } catch (err) {
    return res.status(500).json({ accounts: {}, notes: {}, scrolls: {} });
  }
}
