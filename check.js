import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // Lấy userid từ URL (?userid=12345)
  const userId = request.query.userid;

  if (!userId) {
    return response.status(400).send('Missing userid');
  }

  // Kiểm tra xem userid có trong "set" tên là 'whitelist' không
  const isWhitelisted = await kv.sismember('whitelist', userId);

  if (isWhitelisted) {
    return response.status(200).send('true');
  } else {
    return response.status(200).send('false');
  }
}