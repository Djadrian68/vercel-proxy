// api/claude.js — Proxy a Anthropic (Claude) para Vercel.
// Necesita en Vercel: ANTHROPIC_API_KEY.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo no permitido' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en Vercel' }); return; }

  // Leer el body de forma robusta
  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      if (typeof body === 'string' && body.length) body = JSON.parse(body);
      else {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8');
        body = raw ? JSON.parse(raw) : {};
      }
    } catch (e) { body = {}; }
  }

  const messages = body.messages || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Falta messages' });
    return;
  }

  let maxTok = parseInt(body.max_tokens, 10) || 8000;
  if (maxTok > 16000) maxTok = 16000;
  if (maxTok < 1) maxTok = 8000;

  try {
    const payload = {
      model: body.model || 'claude-sonnet-4-6',
      max_tokens: maxTok,
      messages: messages,
    };
    if (body.system) payload.system = body.system;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (r.status >= 400) {
      console.error('Anthropic error', r.status, JSON.stringify(data));
      res.status(r.status).json({ error: (data.error && data.error.message) || 'Error de Anthropic' });
      return;
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error: ' + e.message });
  }
}
