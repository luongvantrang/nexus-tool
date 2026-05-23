
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'POST') {
            // Web gửi lệnh
            const { userid, command, params } = req.body;
            if (!userid) return res.status(400).json({ error: 'Missing userid' });

            await kv.hset(`cmd:${userid}`, {
                command: command || 'none',
                params: JSON.stringify(params || {}),
                time: Date.now()
            });

            return res.json({ success: true });
        }

        if (req.method === 'GET') {
            // Script lấy lệnh
            const { userid } = req.query;
            if (!userid) return res.status(400).json({ error: 'Missing userid' });

            const data = await kv.hgetall(`cmd:${userid}`);
            if (data && data.command && data.command !== 'none') {
                // Xóa lệnh sau khi lấy
                await kv.hset(`cmd:${userid}`, { command: 'none', params: '{}', time: 0 });
                return res.json({
                    command: data.command,
                    params: JSON.parse(data.params || '{}')
                });
            }

            return res.json({ command: 'none' });
        }
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
