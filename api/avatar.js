export default async function handler(req, res) {
  const { userid } = req.query;
  if (!userid) return res.status(400).send('Missing userid');

  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userid}&size=420x420&format=Png&isCircular=false`
    );
    const data = await response.json();

    if (data.data && data.data[0] && data.data[0].imageUrl) {
      const imgRes = await fetch(data.data[0].imageUrl);
      const buffer = await imgRes.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(Buffer.from(buffer));
    } else {
      res.status(404).send('Not found');
    }
  } catch (err) {
    res.status(500).send('Error');
  }
}
