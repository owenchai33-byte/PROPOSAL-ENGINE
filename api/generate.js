module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    clientName, clientPhone, address, propType, propSize,
    occupants, priority, budget, moveIn, notes, siteNotes,
    selRooms, selWorks, selStyle, selTier, tierRange,
  } = req.body;

  if (!clientName || !propType || !selRooms?.length || !selWorks?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const prompt = `You are writing a professional interior design & renovation proposal for Mushi Space Design Sdn Bhd, Kuching. Tagline: "Space - Style - Living".

STRICT RULES:
1. ONLY include works that are listed in "Works selected" below. Do NOT add any extra works the client did not select. If only "Plumbing Works" is selected, the scope and line items must ONLY cover plumbing. Do not add tiling, carpentry, painting, electrical, or anything else unless explicitly listed.
2. Keep ALL text SHORT and DIRECT. No flowery language. No filler words. Every sentence must be useful.
3. The intro must be 1 sentence max.
4. The understanding must be 2 sentences max.
5. The approach must be 1 sentence max.
6. Scope descriptions must be 1-2 sentences max per room.
7. The closing must be 1 sentence.
8. Line items must ONLY reflect the selected works — nothing extra.

Project details:
- Client: ${clientName}${clientPhone ? ` (${clientPhone})` : ""}
- Address: ${address || "Kuching, Sarawak"}
- Property: ${propType}${propSize ? `, approx. ${propSize} sq ft` : ""}
- Occupants: ${occupants || "Not specified"}
- Rooms selected: ${selRooms.join(", ")}
- Works selected: ${selWorks.join(", ")}
- Design style: ${selStyle || "Not specified"}
- Package: ${selTier} (${tierRange})
- Budget: ${budget ? "RM " + budget : "Not specified"}
- Move-in: ${moveIn || "Flexible"}
- Priority: ${priority || "Not specified"}
- Client notes: ${notes || "None"}
- Site conditions: ${siteNotes || "Standard condition"}

Return ONLY valid JSON, no markdown, no backticks:
{"refNo":"MSD-2026-XXX","intro":"1 sentence intro","understanding":"2 sentences max","approach":"1 sentence max","scopeItems":[{"room":"Room name","works":"1-2 sentences of works for this room, ONLY covering selected works"}],"inclusions":["4-5 short included items relevant to selected works only"],"exclusions":["3-4 short excluded items"],"lineItems":[{"item":"Work item matching selected works only","qty":"1","unit":"lot","amount":"RM XX,XXX"}],"subtotal":"RM XX,XXX","tax":"RM 0 (SST Exempt)","total":"RM XX,XXX","timeline":"X-X weeks","phases":[{"phase":"Phase name","duration":"X weeks","description":"1 sentence"}],"paymentSchedule":[{"milestone":"Upon signing","pct":"30%","amount":"RM XX,XXX"},{"milestone":"Upon design approval","pct":"40%","amount":"RM XX,XXX"},{"milestone":"Upon completion","pct":"30%","amount":"RM XX,XXX"}],"warranty":"12 months defect liability on workmanship","validity":"14 days from proposal date","closing":"1 sentence closing"}

Amounts must fit the ${selTier} tier. ONLY include works the client selected — nothing extra.`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Gemini API error");
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) throw new Error("Empty response from Gemini");

    const clean = raw.replace(/```json|```/g, "").trim();
    const proposal = JSON.parse(clean);
    res.status(200).json({ proposal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
