import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const { userid, key } = req.query;
    const SECRET_KEY = process.env.SECRET_KEY;

    if (!userid || !key) {
      return res.status(400).send('Thiếu UserID hoặc Key');
    }

    if (key !== SECRET_KEY) {
      return res.status(403).send('Key không đúng!');
    }

    await kv.sadd('whitelist', userid.toString());
    
    return res.status(200).send('Thành công! Bạn đã được kích hoạt key.');
  } catch (error) {
    console.error(error);
    return res.status(500).send('Lỗi server');
  }
}
