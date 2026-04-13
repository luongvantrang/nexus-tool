import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  const { userid, key } = request.query;

  // Lấy key bí mật từ Environment Variables của Vercel (bảo mật hơn)
  const SECRET_KEY = process.env.SECRET_KEY;

  if (!userid || !key) {
    return response.status(400).send('Vui lòng nhập đủ UserID và Key.');
  }

  if (key !== SECRET_KEY) {
    return response.status(403).send('Key không hợp lệ!');
  }

  // Thêm userid vào database (set 'whitelist')
  await kv.sadd('whitelist', userid);

  return response.status(200).send('Thành công! Bạn đã được thêm vào danh sách. Hãy chạy lại script.');
}