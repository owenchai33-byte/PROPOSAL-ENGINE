const MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.5-flash",
];

async function callGemini(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Gemini error");
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!raw) throw new Error("Empty response");
  return raw;
}

async function callWithRetry(apiKey, prompt) {
  let lastError;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await callGemini(apiKey, model, prompt);
      } catch (err) {
        lastError = err;
        const isOverload = err.message?.toLowerCase().includes("overloaded") ||
                           err.message?.toLowerCase().includes("high demand") ||
                           err.message?.toLowerCase().includes("503") ||
                           err.message?.toLowerCase().includes("unavailable");
        if (isOverload && attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1500));
          continue;
        }
        if (isOverload) break;
        throw err;
      }
    }
  }
  throw lastError || new Error("All models unavailable. Please try again in a moment.");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { projectName, clientName, completed, nextSteps, issues, progress, language } = req.body;
  if (!completed || !nextSteps) return res.status(400).json({ error: "Missing required fields" });

  const langMap = { en: "English", ms: "Malay (Bahasa Malaysia)", zh: "Mandarin Chinese (Simplified)" };
  const langName = langMap[language] || "English";
  const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });

  const prompt = `You are writing a professional renovation progress update message for Mushi Space Design Sdn Bhd to send to their client via WhatsApp.
Project: ${projectName}
Client: ${clientName}
Date: ${today}
Overall progress: ${progress}%
Language: ${langName}
Raw notes from site supervisor:
- Completed today: ${completed}
- Next steps: ${nextSteps}
- Issues or delays: ${issues || "None"}
Write a professional, warm, clear WhatsApp update message in ${langName}.
Rules:
- Concise, easy to read on a phone
- Use emojis: ✅ completed, 🔨 next steps, ⚠️ issues, 📊 progress
- Warm but professional tone
- End with a reassuring closing line
- Skip issues section if there are none
- If Malay or Chinese, write naturally — not a direct translation
- Do NOT include any preamble like "Here is the message:" — write the message directly
- Start with a greeting to the client by name`;

  try {
    const message = await callWithRetry(process.env.GEMINI_API_KEY, prompt);
    return res.status(200).json({ message });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
