import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { userid, key } = req.query;
  const SECRET_KEY = process.env.SECRET_KEY;

  if (!userid || !key) {
    return res.status(400).send('Thiếu thông tin');
  }

  if (key !== SECRET_KEY) {
    return res.status(403).send('Key không đúng!');
  }

  await kv.sadd('whitelist', userid);
  return res.status(200).send('Key hợp lệ! Bạn có thể dùng script.');
}
