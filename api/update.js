import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    // Parse body an toàn (phòng khi không tự parse)
    let stats = req.body;
    if (typeof stats === 'string') {
      stats = JSON.parse(stats);
    }

    if (!stats || !stats.userid) {
      console.error('[UPDATE] Missing userid. Body:', JSON.stringify(req.body));
      return res.status(400).send('Missing userid');
    }

    const userid = String(stats.userid);
    const key = `account_${userid}`;

    stats.lastUpdate = new Date().toLocaleString('vi-VN');
    stats.lastRaw    = new Date().toISOString();

    await Promise.all([
      kv.set(key, stats, { ex: 7200 }),
      kv.sadd('account_ids', userid)
    ]);

    console.log(`[UPDATE] Saved account ${userid} (${stats.player})`);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[UPDATE ERROR]', err.message);
    return res.status(500).send('Error: ' + err.message);
  }
}
