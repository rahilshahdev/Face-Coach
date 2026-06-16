export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { transcript, metrics, customApiKey, customModel } = req.body;
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing Gemini API Key. Paste your key in Settings (gear icon in header) or configure environment variables." });
  }

  const prompt = `You are an expert public speaking coach. The user just finished a speaking session. Transcript: [${transcript || 'No speech recorded'}].
Metrics: Eye contact ${metrics.eyeContact}%, Filler words: ${metrics.fillerWords}, Avg pace: ${metrics.avgPace} wpm, Long pauses: ${metrics.longPauses}. Give exactly 3 strengths and 3 specific improvements in simple, encouraging language. Format as JSON: {"strengths": [], "improvements": []}`;

  try {
    const modelName = customModel || 'gemini-3.1-flash-lite';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });
    
    const data = (await response.json()) as any;
    const text = data.candidates[0].content.parts[0].text;
    
    let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const result = JSON.parse(cleanText);
    
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate feedback" });
  }
}
