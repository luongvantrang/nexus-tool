import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { userid } = req.query;

  if (!userid) return res.status(400).send('Missing userid');

  const isAllowed = await kv.sismember('whitelist', userid);

  return res.status(200).send(isAllowed ? 'true' : 'false');
}
