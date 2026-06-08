const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

async function callGemini(apiKey, model, prompt) {
  const version = model.includes("1.5") ? "v1" : "v1beta";
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Gemini error");
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!raw) throw new Error("Empty response");
  return raw;
}

function shouldTryNext(msg) {
  const m = (msg || "").toLowerCase();
  return m.includes("quota") || m.includes("rate") || m.includes("resource_exhausted") ||
    m.includes("429") || m.includes("503") || m.includes("overloaded") ||
    m.includes("unavailable") || m.includes("not found") || m.includes("not support");
}

async function callWithRetry(apiKey, prompt) {
  let lastError;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { return await callGemini(apiKey, model, prompt); }
      catch (err) {
        lastError = err;
        const retryable = (err.message || "").toLowerCase().includes("overloaded");
        if (retryable && attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
        if (shouldTryNext(err.message)) break;
        throw err;
      }
    }
  }
  throw lastError || new Error("AI unavailable");
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, phone, property_type, address, rooms, budget_range, start_date, referral_source, project_description } = req.body;

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_ANON_KEY;
  const H = { "Content-Type": "application/json", "apikey": KEY, "Authorization": `Bearer ${KEY}` };

  // Score the lead with AI
  const prompt = `You are helping Mushi Space Design Sdn Bhd (an interior design and renovation company in Kuching, Malaysia) qualify an incoming lead.

Score this lead as HOT, WARM, or COLD based on:
- HOT: Realistic budget for scope, clear timeline (within 6 months), specific about needs, referred by someone
- WARM: Partial budget match, vague timeline, moderate specificity
- COLD: Unrealistic budget for scope, no timeline, very vague, or clearly just browsing

Lead details:
- Name: ${name}
- Property type: ${property_type}
- Location: ${address || "Not specified"}
- Rooms: ${(rooms || []).join(", ") || "Not specified"}
- Budget: ${budget_range}
- Start date: ${start_date || "Not specified"}
- How they heard about us: ${referral_source || "Not specified"}
- Project description: ${project_description || "None provided"}

Malaysian renovation context:
- Full condo renovation: RM60k–120k+
- Partial renovation (2–3 rooms): RM30k–60k
- Single room: RM15k–30k
- Budget "Under RM30k" for full renovation = unrealistic = lower score

Return ONLY a JSON object, no markdown:
{"score":"HOT","summary":"2 sentence summary of this lead and why they scored this way. Be specific and useful for the sales team."}`;

  let score = "WARM";
  let ai_summary = "Lead submitted — AI scoring unavailable.";

  try {
    const raw = await callWithRetry(process.env.GEMINI_API_KEY, prompt);
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    score = parsed.score || "WARM";
    ai_summary = parsed.summary || ai_summary;
  } catch (e) {
    console.error("AI scoring failed:", e.message);
  }

  // Save to Supabase
  try {
    const r = await fetch(`${SB}/rest/v1/leads`, {
      method: "POST",
      headers: { ...H, "Prefer": "return=representation" },
      body: JSON.stringify({ name, phone, property_type, address, rooms, budget_range, start_date, referral_source, project_description, score, ai_summary, status: "new" }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.message || "Failed to save lead" });
    return res.status(201).json({ ok: true, lead: data[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
