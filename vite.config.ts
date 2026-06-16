import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      {
        name: 'local-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/analyze' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk.toString(); });
              req.on('end', async () => {
                try {
                  const { transcript, metrics, customApiKey, customModel } = JSON.parse(body);
                  const prompt = `You are an expert public speaking coach. The user just finished a speaking session. Transcript: [${transcript || 'No speech recorded'}].
Metrics: Eye contact ${metrics.eyeContact}%, Filler words: ${metrics.fillerWords}, Avg pace: ${metrics.avgPace} wpm, Long pauses: ${metrics.longPauses}. Give exactly 3 strengths and 3 specific improvements in simple, encouraging language. Format as JSON: {"strengths": [], "improvements": []}`;

                  const apiKey = customApiKey || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
                  if (!apiKey) {
                    res.statusCode = 500;
                    return res.end(JSON.stringify({ error: "Missing Gemini API Key. Paste your key in Settings (gear icon in header) or configure environment variables." }));
                  }

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
                  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
                  
                  res.setHeader('Content-Type', 'application/json');
                  res.end(cleanText);
                } catch (e) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: "Internal Server Error" }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
  }
})
