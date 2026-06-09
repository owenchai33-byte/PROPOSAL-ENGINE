module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const results = {};

  // Check env vars exist
  results.gemini_key_exists = !!process.env.GEMINI_API_KEY;
  results.groq_key_exists = !!process.env.GROQ_API_KEY;
  results.gemini_key_prefix = process.env.GEMINI_API_KEY?.substring(0,8) + "...";
  results.groq_key_prefix = process.env.GROQ_API_KEY?.substring(0,8) + "...";

  // Test Groq directly
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Say hello in one word." }],
        max_tokens: 10,
      }),
    });
    const data = await r.json();
    if (data.error) {
      results.groq_test = "FAIL: " + data.error.message;
    } else {
      results.groq_test = "OK: " + (data?.choices?.[0]?.message?.content || "empty");
    }
  } catch (e) {
    results.groq_test = "ERROR: " + e.message;
  }

  // Test one Gemini model
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Say hello in one word." }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    const data = await r.json();
    if (data.error) {
      results.gemini_test = "FAIL: " + data.error.message;
    } else {
      results.gemini_test = "OK: " + (data?.candidates?.[0]?.content?.parts?.[0]?.text || "empty");
    }
  } catch (e) {
    results.gemini_test = "ERROR: " + e.message;
  }

  return res.status(200).json(results);
};
