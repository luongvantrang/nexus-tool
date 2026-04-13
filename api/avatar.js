export default async function handler(req, res) {
  const { userid } = req.query;

  if (!userid) return res.status(400).send('Missing userid');

  try {
    // Gọi Roblox API từ server (không bị CORS)
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userid}&size=420x420&format=Png&isCircular=false`
    );
    const data = await response.json();

    if (data.data && data.data[0] && data.data[0].imageUrl) {
      // Lấy link ảnh thật
      const imageUrl = data.data[0].imageUrl;

      // Fetch ảnh về
      const imgRes = await fetch(imageUrl);
      const buffer = await imgRes.arrayBuffer();

      // Trả về ảnh thật
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(Buffer.from(buffer));
    } else {
      res.status(404).send('Avatar not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
}
