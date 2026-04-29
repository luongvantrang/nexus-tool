import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { userid } = req.query;

  if (!userid) {
    return res.status(400).json({ error: 'Thiếu userid' });
  }

  const cmdKey = `cmd_${userid}`;

  // 1. DÀNH CHO TRANG WEB (POST): Gửi lệnh xuống game
  if (req.method === 'POST') {
    const command = req.body; 
    // Lệnh lưu vào database, tự động hủy sau 60 giây nếu game không nhận
    await kv.set(cmdKey, command, { ex: 60 }); 
    return res.status(200).json({ message: 'Đã phát lệnh thành công!' });
  }

  // 2. DÀNH CHO ROBLOX LUA (GET): Hỏi xem có lệnh gì không
  if (req.method === 'GET') {
    const command = await kv.get(cmdKey);
    
    if (command) {
      // Đọc được lệnh thì xóa luôn khỏi Database để game không bị lặp lại thao tác
      await kv.del(cmdKey); 
      return res.status(200).json(command);
    } else {
      return res.status(200).json({ action: "none" });
    }
  }

  return res.status(405).send('Method not allowed');
}
