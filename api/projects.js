const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
const H = { "Content-Type": "application/json", "apikey": KEY, "Authorization": `Bearer ${KEY}` };
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "GET") {
    const r = await fetch(`${SB}/rest/v1/projects?order=created_at.desc`, { headers: H });
    return res.status(200).json(await r.json());
  }
  if (req.method === "POST") {
    const { name, client_name, client_phone, address } = req.body;
    if (!name || !client_name) return res.status(400).json({ error: "Name and client name required" });
    const r = await fetch(`${SB}/rest/v1/projects`, { method: "POST", headers: { ...H, "Prefer": "return=representation" }, body: JSON.stringify({ name, client_name, client_phone, address }) });
    const data = await r.json();
    return res.status(201).json(data[0]);
  }
  if (req.method === "PATCH") {
    const { id, ...fields } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    const r = await fetch(`${SB}/rest/v1/projects?id=eq.${id}`, { method: "PATCH", headers: { ...H, "Prefer": "return=representation" }, body: JSON.stringify(fields) });
    const data = await r.json();
    return res.status(200).json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    await fetch(`${SB}/rest/v1/projects?id=eq.${id}`, { method: "DELETE", headers: H });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Method not allowed" });
};
