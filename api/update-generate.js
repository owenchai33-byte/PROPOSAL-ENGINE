const GEMINI_MODELS = [
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
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Gemini error");
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!raw) throw new Error("Empty response");
  return raw;
}

async function callGroq(apiKey, prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 1024,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Groq error");
  const raw = data?.choices?.[0]?.message?.content || "";
  if (!raw) throw new Error("Empty response from Groq");
  return raw;
}

function isQuotaError(msg) {
  const m = (msg || "").toLowerCase();
  return m.includes("quota") || m.includes("rate limit") || m.includes("resource_exhausted") ||
    m.includes("429") || m.includes("503") || m.includes("overloaded") ||
    m.includes("unavailable") || m.includes("not found") || m.includes("not support");
}

async function callWithRetry(geminiKey, groqKey, prompt) {
  for (const model of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await callGemini(geminiKey, model, prompt);
      } catch (err) {
        const retryable = (err.message || "").toLowerCase().includes("overloaded");
        if (retryable && attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
        if (isQuotaError(err.message)) break;
        throw err;
      }
    }
  }

  // Groq fallback
  if (groqKey) {
    try {
      console.log("Gemini quota exhausted — falling back to Groq");
      return await callGroq(groqKey, prompt);
    } catch (err) {
      console.error("Groq fallback failed:", err.message);
    }
  }

  throw new Error("AI service is temporarily unavailable. Please try again in a few minutes.");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { projectName, clientName, completed, nextSteps, issues, progress, language, hasPhotos } = req.body;
  if (!completed || !nextSteps) return res.status(400).json({ error: "Missing required fields" });

  const langMap = { en: "English", ms: "Malay (Bahasa Malaysia)", zh: "Mandarin Chinese (Simplified)" };
  const langName = langMap[language] || "English";
  const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });

  const photoLine = hasPhotos
    ? (language === "zh" ? "📷 请查看附上的工地照片。" : language === "ms" ? "📷 Sila lihat foto tapak yang dilampirkan." : "📷 Site photos are attached below.")
    : "";

  const prompt = `You are writing a WhatsApp renovation progress update message for Mushi Space Design Sdn Bhd to send to their client.

Write the message in ${langName}. Be warm, professional, and easy to read on a phone.

Project: ${projectName}
Client name: ${clientName}
Date: ${today}
Overall progress: ${progress}%

COMPLETED TODAY — include EVERY item listed below, do not skip or shorten anything:
${completed}

NEXT STEPS — include EVERY item listed below, do not skip or shorten anything:
${nextSteps}

${issues ? `DELAYS OR ISSUES — you MUST mention this:\n${issues}` : "No delays or issues."}

${hasPhotos ? "PHOTOS: Site photos are attached. Include a line mentioning the photos." : ""}

FORMAT RULES:
- Start with a warm greeting using the client's name
- Use 📊 for the progress percentage
- Use ✅ for completed work — list ALL items from "COMPLETED TODAY", one per line
- Use 🔨 for next steps — list ALL items from "NEXT STEPS", one per line
- Use ⚠️ for delays or issues — include if there are any
- End with a short reassuring closing line
- Write naturally in ${langName}, not word-for-word translation
- Do NOT summarize or shorten — use everything provided`;

  try {
    const message = await callWithRetry(process.env.GEMINI_API_KEY, process.env.GROQ_API_KEY, prompt);
    const finalMessage = hasPhotos && !message.includes("📷")
      ? message.trim() + "\n\n" + photoLine
      : message;
    return res.status(200).json({ message: finalMessage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
