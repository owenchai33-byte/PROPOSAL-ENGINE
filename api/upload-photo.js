module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { filename, contentType, data } = req.body;
    if (!filename || !data) return res.status(400).json({ error: "Missing data" });
    const buffer = Buffer.from(data, "base64");
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;
    const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/site-photos/${uniqueName}`, {
      method: "POST",
      headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`, "Content-Type": contentType || "image/jpeg", "x-upsert": "true" },
      body: buffer,
    });
    if (!r.ok) throw new Error(await r.text());
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/site-photos/${uniqueName}`;
    return res.status(200).json({ url: publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
