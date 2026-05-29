module.exports = (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { password } = req.body;
  const correct = process.env.APP_PASSWORD;
  if (!correct) return res.status(500).json({ error: "Password not configured" });
  if (password === correct) return res.status(200).json({ ok: true });
  return res.status(401).json({ error: "Wrong password" });
};
 
