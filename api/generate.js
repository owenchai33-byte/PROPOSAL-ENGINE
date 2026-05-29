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

  const prompt = `You are writing a professional interior design & renovation proposal for Mushi Space Design Sdn Bhd, a Kuching-based design-build firm. Tagline: "Space - Style - Living".

Project:
- Client: ${clientName}${clientPhone ? ` (${clientPhone})` : ""}
- Address: ${address || "Kuching, Sarawak"}
- Property: ${propType}${propSize ? `, approx. ${propSize} sq ft` : ""}
- Occupants: ${occupants || "Not specified"}
- Rooms: ${selRooms.join(", ")}
- Works: ${selWorks.join(", ")}
- Style: ${selStyle || "Not specified"}
- Package: ${selTier} (${tierRange})
- Budget: ${budget ? "RM " + budget : "Not specified"}
- Move-in: ${moveIn || "Flexible"}
- Priority: ${priority || "Not specified"}
- Notes: ${notes || "None"}
- Site: ${siteNotes || "Standard condition"}

Return ONLY valid JSON, no markdown, no backticks, no explanation before or after:
{"refNo":"MSD-2026-XXX","intro":"Warm 2-sentence intro to client","understanding":"3 sentences showing understanding of project and lifestyle","approach":"2 sentences on Mushi design-build approach","scopeItems":[{"room":"Room name","works":"Detailed works for this room"}],"inclusions":["5-7 included items"],"exclusions":["3-4 excluded items"],"lineItems":[{"item":"Work item","qty":"1","unit":"lot","amount":"RM XX,XXX"}],"subtotal":"RM XX,XXX","tax":"RM 0 (SST Exempt)","total":"RM XX,XXX","timeline":"X-X weeks","phases":[{"phase":"Phase name","duration":"X weeks","description":"What happens in this phase"}],"paymentSchedule":[{"milestone":"Upon signing","pct":"30%","amount":"RM XX,XXX"},{"milestone":"Upon design approval","pct":"40%","amount":"RM XX,XXX"},{"milestone":"Upon completion","pct":"30%","amount":"RM XX,XXX"}],"warranty":"12 months defect liability on workmanship","validity":"14 days from proposal date","closing":"Warm 2-sentence closing statement"}

Make lineItems realistic and specific to the selected works. Amounts must fit the ${selTier} tier. Each scopeItem must reflect actual works for that room.`;

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
          temperature: 0.7,
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
