// All use v1beta — widest model support on free Google AI Studio keys
const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

async function callGemini(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Gemini error");
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!raw) throw new Error("Empty response");
  return raw;
}

function shouldTryNext(errMsg) {
  const m = errMsg.toLowerCase();
  return (
    m.includes("quota") || m.includes("rate limit") || m.includes("resource_exhausted") ||
    m.includes("429") || m.includes("503") || m.includes("overloaded") ||
    m.includes("unavailable") || m.includes("high demand") ||
    m.includes("not found") || m.includes("not support") || m.includes("404")
  );
}

async function callWithRetry(apiKey, prompt) {
  let lastError;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await callGemini(apiKey, model, prompt);
      } catch (err) {
        lastError = err;
        const retryable = err.message?.toLowerCase().includes("overloaded") ||
                          err.message?.toLowerCase().includes("503");
        if (retryable && attempt < 2) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        // Any model error — try next model
        if (shouldTryNext(err.message || "")) break;
        throw err; // only stop for real errors (bad request, invalid key, etc.)
      }
    }
  }
  throw new Error("AI service is temporarily busy. Please wait a few seconds and try again.");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    clientName, clientPhone, address, propType, propSize,
    occupants, priority, budget, moveIn, notes, siteNotes,
    selRooms, selWorks, selStyle, selTier, tierRange, customPrices,
  } = req.body;

  if (!clientName || !propType || !selRooms?.length || !selWorks?.length)
    return res.status(400).json({ error: "Missing required fields" });

  const hasPrices = customPrices && Object.keys(customPrices).length > 0;
  const pricingBlock = hasPrices
    ? `PRICING — use these EXACT amounts:\n${Object.entries(customPrices).map(([k,v]) => `- ${k}: RM ${v}`).join("\n")}\nEstimate anything not listed within the ${selTier} tier.`
    : `Estimate all prices within the ${selTier} tier (${tierRange}).`;

  const prompt = `You are writing a professional interior design & renovation proposal for Mushi Space Design Sdn Bhd, Kuching. Tagline: "Space - Style - Living".
STRICT RULES:
1. ONLY include works listed in "Works selected". Do NOT add anything extra.
2. Keep ALL text SHORT and DIRECT. No flowery language.
3. Intro: 1 sentence. Understanding: 2 sentences. Approach: 1 sentence. Scope per room: 1-2 sentences. Closing: 1 sentence.
4. Line items must ONLY reflect selected works.
Project:
- Client: ${clientName}${clientPhone ? ` (${clientPhone})` : ""}
- Address: ${address || "Kuching, Sarawak"}
- Property: ${propType}${propSize ? `, approx. ${propSize} sq ft` : ""}
- Occupants: ${occupants || "Not specified"}
- Rooms selected: ${selRooms.join(", ")}
- Works selected: ${selWorks.join(", ")}
- Style: ${selStyle || "Not specified"}
- Package: ${selTier} (${tierRange})
- Budget: ${budget ? "RM " + budget : "Not specified"}
- Move-in: ${moveIn || "Flexible"}
- Priority: ${priority || "Not specified"}
- Notes: ${notes || "None"}
- Site: ${siteNotes || "Standard condition"}
${pricingBlock}
Return ONLY valid JSON, no markdown, no backticks:
{"refNo":"MSD-2026-XXX","intro":"1 sentence","understanding":"2 sentences","approach":"1 sentence","scopeItems":[{"room":"Room","works":"1-2 sentences"}],"inclusions":["4-5 items"],"exclusions":["3-4 items"],"lineItems":[{"item":"Work item","qty":"1","unit":"lot","amount":"RM XX,XXX"}],"subtotal":"RM XX,XXX","tax":"RM 0 (SST Exempt)","total":"RM XX,XXX","timeline":"X-X weeks","phases":[{"phase":"Name","duration":"X weeks","description":"1 sentence"}],"paymentSchedule":[{"milestone":"Upon signing","pct":"30%","amount":"RM XX,XXX"},{"milestone":"Upon design approval","pct":"40%","amount":"RM XX,XXX"},{"milestone":"Upon completion","pct":"30%","amount":"RM XX,XXX"}],"warranty":"12 months defect liability on workmanship","validity":"14 days from proposal date","closing":"1 sentence"}`;

  try {
    const raw = await callWithRetry(process.env.GEMINI_API_KEY, prompt);
    const proposal = JSON.parse(raw.replace(/```json|```/g, "").trim());
    res.status(200).json({ proposal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
