import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const keys = await kv.keys('account_*');
    const accounts = {};

    for (const key of keys) {
      const data = await kv.get(key);
      if (data) accounts[data.userid] = data;
    }

    res.status(200).json(accounts);
  } catch (err) {
    res.status(500).json({});
  }
}
