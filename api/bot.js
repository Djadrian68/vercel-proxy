// api/bot.js — Asistente de visitantes con OpenAI, para Vercel.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ reply: 'Metodo no permitido' }); return; }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(500).json({ reply: 'Falta configurar la API key.' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const msg = (body.message || '').trim();
    if (!msg) { res.status(200).json({ reply: 'En que te puedo ayudar?' }); return; }

    let faqText = '';
    (body.faqs || []).forEach(f => {
      if (f.q && f.a) faqText += `P: ${f.q}\nR: ${f.a}\n\n`;
    });

    const tonos = {
      amable: 'Hablas de forma amable y cordial.',
      profesional: 'Hablas de forma profesional y formal.',
      alegre: 'Hablas de forma alegre y divertida, con energia.',
      dinamico: 'Hablas de forma dinamica y directa.',
      calido: 'Hablas de forma calida y cercana.',
      elegante: 'Hablas de forma elegante y sofisticada.',
      canchero: 'Hablas de forma canchera y relajada, con onda argentina.'
    };
    const personajes = {
      neutro: 'Sos un asistente virtual.',
      mujer: 'Sos una asistenta. Te referis a vos misma en femenino.',
      hombre: 'Sos un asistente. Te referis a vos mismo en masculino.',
      joven_f: 'Sos una chica joven y simpatica.',
      joven_m: 'Sos un chico joven y simpatico.',
      experto: 'Sos un experto del rubro.',
      mayordomo: 'Sos un mayordomo formal y atento.'
    };
    const tonoTxt = tonos[body.tono] || tonos.amable;
    const persTxt = personajes[body.personaje] || personajes.neutro;

    const system =
`Sos el asistente virtual de un negocio que atiende a sus visitantes web.
${persTxt} ${tonoTxt}
Responde SOLO con la informacion provista abajo. Si no sabes algo, deci amablemente que no tenes ese dato y sugeri contactar al negocio.
Se breve y claro. Espanol rioplatense, trato de 'vos'. No inventes datos, precios ni horarios.
Responde en texto plano, SIN formato Markdown.

=== INFORMACION DEL NEGOCIO ===
${body.business_info || '(sin informacion cargada)'}

=== PREGUNTAS FRECUENTES ===
${faqText}`;

    const messages = [];
    messages.push({ role: 'system', content: system });
    (body.history || []).slice(-8).forEach(h => {
      messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '') });
    });
    messages.push({ role: 'user', content: msg });

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 600, messages }),
    });

    const data = await r.json();
    if (r.status >= 400) {
      console.error('OpenAI bot error', r.status, JSON.stringify(data));
      res.status(200).json({ reply: 'Disculpa, tuve un problema tecnico. Proba de nuevo.' });
      return;
    }
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    res.status(200).json({ reply: reply.trim() || 'Disculpa, no pude responder.' });
  } catch (e) {
    res.status(200).json({ reply: 'Tuve un problema tecnico. Proba de nuevo.' });
  }
}
