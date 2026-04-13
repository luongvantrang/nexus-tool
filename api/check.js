import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const { userid } = req.query;
    
    if (!userid) {
      return res.status(400).send('Missing userid');
    }

    const isWhitelisted = await kv.sismember('whitelist', userid.toString());
    
    return res.status(200).send(isWhitelisted ? 'true' : 'false');
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server error');
  }
}
