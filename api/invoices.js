const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
const H = { "Content-Type": "application/json", "apikey": KEY, "Authorization": `Bearer ${KEY}` };

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: "project_id required" });
    const r = await fetch(`${SB}/rest/v1/invoices?project_id=eq.${project_id}&order=created_at.desc`, { headers: H });
    return res.status(200).json(await r.json());
  }

  if (req.method === "POST") {
    const { project_id, title, line_items, total, due_date, payment_method, notes } = req.body;
    if (!project_id || !title) return res.status(400).json({ error: "project_id and title required" });

    // Auto-generate invoice number: INV-YYYY-XXX
    const countR = await fetch(`${SB}/rest/v1/invoices?project_id=eq.${project_id}&select=id`, { headers: H });
    const existing = await countR.json();
    const num = String((existing.length || 0) + 1).padStart(3, "0");
    const year = new Date().getFullYear();
    const invoice_number = `INV-${year}-${num}`;

    const r = await fetch(`${SB}/rest/v1/invoices`, {
      method: "POST",
      headers: { ...H, "Prefer": "return=representation" },
      body: JSON.stringify({ project_id, invoice_number, title, line_items, total, due_date, payment_method, notes, status: "draft" }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.message || "Failed to create invoice" });
    return res.status(201).json(data[0]);
  }

  if (req.method === "PATCH") {
    const { id, ...fields } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    const r = await fetch(`${SB}/rest/v1/invoices?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...H, "Prefer": "return=representation" },
      body: JSON.stringify(fields),
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.message || "Failed to update invoice" });
    return res.status(200).json(data[0] || {});
  }

  if (req.method === "DELETE") {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    await fetch(`${SB}/rest/v1/invoices?id=eq.${id}`, { method: "DELETE", headers: H });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
