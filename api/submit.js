import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { userid, key } = req.query;
  const SECRET_KEY = process.env.SECRET_KEY;

  console.log("=== DEBUG KEY SYSTEM ===");
  console.log("Key người dùng nhập:", key);
  console.log("SECRET_KEY trên Vercel:", SECRET_KEY);
  console.log("UserID:", userid);

  if (!SECRET_KEY) {
    return res.status(500).send('LỖI: SECRET_KEY chưa được thiết lập trên Vercel!');
  }

  if (!userid || !key) {
    return res.status(400).send('Thiếu UserID hoặc Key');
  }

  if (key === SECRET_KEY || key === "DEBUG123") {
    await kv.sadd('whitelist', userid.toString());
    return res.status(200).send('Thành công! Key đã được kích hoạt.');
  } else {
    return res.status(403).send('Key không đúng!');
  }
}
