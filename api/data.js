import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const data = await kv.get('atlantis_stats');
    res.status(200).json(data || { lastUpdate: "Chưa có dữ liệu" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
}
