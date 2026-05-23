import { kv } from '@vercel/kv';

// Danh sách action hợp lệ
const VALID_ACTIONS = ['equip_weapon', 'swap_build'];

export default async function handler(req, res) {
  const { userid } = req.query;
  if (!userid) return res.status(400).json({ error: 'Thiếu userid' });

  const cmdKey = `cmd_${userid}`;

  // POST: Web gửi lệnh xuống game
  if (req.method === 'POST') {
    const command = req.body;

    // Validate lệnh
    if (!command || !VALID_ACTIONS.includes(command.action)) {
      return res.status(400).json({ error: 'Lệnh không hợp lệ' });
    }
    if (!command.weapon || typeof command.weapon !== 'string') {
      return res.status(400).json({ error: 'Thiếu thông tin vũ khí' });
    }
    // Sanitize input
    command.weapon = command.weapon.slice(0, 50);
    command.main_stat = (command.main_stat || '').slice(0, 30);

    await kv.set(cmdKey, command, { ex: 60 });
    return res.status(200).json({ message: 'Đã phát lệnh thành công!' });
  }

  // GET: Roblox Lua hỏi lệnh
  if (req.method === 'GET') {
    const command = await kv.get(cmdKey);
    if (command) {
      await kv.del(cmdKey);
      return res.status(200).json(command);
    }
    return res.status(200).json({ action: 'none' });
  }

  return res.status(405).send('Method not allowed');
}
