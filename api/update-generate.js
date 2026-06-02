const MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-2.0-flash-lite",
];

async function callGemini(apiKey, model, prompt) {
  const version = model.includes("1.5") ? "v1" : "v1beta";
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
  const genConfig = { temperature: 0.6, maxOutputTokens: 1024 };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: genConfig,
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
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await callGemini(apiKey, model, prompt);
      } catch (err) {
        lastError = err;
        const msg = err.message?.toLowerCase() || "";
        const isRetryable = msg.includes("overloaded") || msg.includes("503") || msg.includes("unavailable") || msg.includes("high demand");
        const isQuotaHit = msg.includes("quota") || msg.includes("rate limit") || msg.includes("429") || msg.includes("resource_exhausted");
        if (isRetryable && attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
        if (isRetryable || isQuotaHit) break;
        throw err;
      }
    }
  }
  throw new Error("AI service is temporarily unavailable. Please wait a moment and try again.");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { projectName, clientName, completed, nextSteps, issues, progress, language } = req.body;
  if (!completed || !nextSteps) return res.status(400).json({ error: "Missing required fields" });
  const langMap = { en: "English", ms: "Malay (Bahasa Malaysia)", zh: "Mandarin Chinese (Simplified)" };
  const langName = langMap[language] || "English";
  const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });
  const prompt = `You are writing a professional renovation progress update for Mushi Space Design Sdn Bhd to send to their client via WhatsApp.
Project: ${projectName}
Client: ${clientName}
Date: ${today}
Overall progress: ${progress}%
Language: ${langName}
Completed today: ${completed}
Next steps: ${nextSteps}
Issues: ${issues || "None"}
Write a professional, warm, clear WhatsApp message in ${langName}.
Rules: Concise, easy to read on phone. Use emojis: completed, next steps, issues, progress. Skip issues if none. Natural language. No preamble. Start with client greeting.`;
  try {
    const message = await callWithRetry(process.env.GEMINI_API_KEY, prompt);
    return res.status(200).json({ message });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
