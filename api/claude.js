// api/claude.js — Proxy a OpenAI para Vercel (serverless)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo no permitido' }); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Falta OPENAI_API_KEY en Vercel' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!body.messages) { res.status(400).json({ error: 'Falta messages' }); return; }

    let maxTok = parseInt(body.max_tokens, 10) || 8000;
    if (maxTok > 16000) maxTok = 16000;
    if (maxTok < 1) maxTok = 8000;

    const openaiMessages = [];
    if (body.system) openaiMessages.push({ role: 'system', content: body.system });
    (body.messages || []).forEach(m => {
      let txt = '';
      if (typeof m.content === 'string') txt = m.content;
      else if (Array.isArray(m.content)) {
        txt = m.content.map(p => (typeof p === 'string' ? p : (p.text || ''))).join('\n');
      }
      openaiMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: txt });
    });

    const payload = {
      model: body.openai_model || 'gpt-4o',
      max_tokens: maxTok,
      messages: openaiMessages,
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (r.status >= 400) {
      console.error('OpenAI error', r.status, JSON.stringify(data));
      res.status(r.status).json({ error: (data.error && data.error.message) || 'Error de OpenAI' });
      return;
    }

    const texto = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    res.status(200).json({
      content: [{ type: 'text', text: texto }],
      model: data.model || payload.model,
      usage: data.usage || {},
    });
  } catch (e) {
    res.status(500).json({ error: 'Error: ' + e.message });
  }
}
