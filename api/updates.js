const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
const H = { "Content-Type": "application/json", "apikey": KEY, "Authorization": `Bearer ${KEY}` };
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "GET") {
    const { project_id } = req.query;
    const url = project_id
      ? `${SB}/rest/v1/updates?project_id=eq.${project_id}&order=created_at.desc`
      : `${SB}/rest/v1/updates?order=created_at.desc&limit=100`;
    const r = await fetch(url, { headers: H });
    return res.status(200).json(await r.json());
  }
  if (req.method === "POST") {
    const { project_id, completed, next_steps, issues, progress, language, generated_message, photos } = req.body;
    if (!project_id || !generated_message) return res.status(400).json({ error: "Missing required fields" });
    const r = await fetch(`${SB}/rest/v1/updates`, {
      method: "POST", headers: { ...H, "Prefer": "return=representation" },
      body: JSON.stringify({ project_id, completed, next_steps, issues, progress, language, generated_message, photos: photos || [] }),
    });
    const data = await r.json();
    await fetch(`${SB}/rest/v1/projects?id=eq.${project_id}`, { method: "PATCH", headers: H, body: JSON.stringify({ progress }) });
    return res.status(201).json(data[0]);
  }
  return res.status(405).json({ error: "Method not allowed" });
};
