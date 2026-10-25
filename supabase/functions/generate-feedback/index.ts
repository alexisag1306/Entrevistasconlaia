import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const DAILY_REQUEST_LIMIT = 40;
const MAX_PROMPT_LENGTH = 18_000;
const GEMINI_ATTEMPTS = 2;
const GEMINI_ATTEMPT_TIMEOUT_MS = 30_000;

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Método no permitido.' });

  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!authorization?.startsWith('Bearer ')) return jsonResponse(401, { error: 'Inicia sesión para evaluar respuestas.' });
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiKey) {
    return jsonResponse(503, { error: 'La evaluación con IA aún no está configurada en el servidor.' });
  }

  let payload: { prompt?: unknown; responseFormat?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_PROMPT_LENGTH + 256) {
      return jsonResponse(413, { error: 'La solicitud supera el tamaño permitido.' });
    }
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: 'La solicitud no tiene un formato válido.' });
  }

  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  const responseFormat = payload.responseFormat === 'json' ? 'json' : 'text';
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return jsonResponse(400, { error: 'El contenido de la evaluación no es válido.' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) return jsonResponse(401, { error: 'La sesión no es válida.' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: quotaError } = await adminClient.rpc('consume_ai_usage_limit', {
    p_user_id: user.id,
    p_daily_limit: DAILY_REQUEST_LIMIT,
  });
  if (quotaError) {
    console.error('No se pudo verificar el límite diario de IA.');
    return jsonResponse(503, { error: 'No se pudo validar el límite de uso. Inténtalo más tarde.' });
  }
  if (!allowed) return jsonResponse(429, { error: 'Alcanzaste el límite diario de evaluaciones. Inténtalo mañana.' });

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.6-flash';
  const isGemini3 = /^gemini-3\./.test(model);
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      ...(!isGemini3 ? { temperature: responseFormat === 'json' ? 0.3 : 0.4 } : {}),
      maxOutputTokens: responseFormat === 'json' ? 1200 : 200,
      ...(responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
      ...(isGemini3 ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
    },
  });
  let response: Response | null = null;
  let requestError: unknown = null;

  try {
    for (let attempt = 1; attempt <= GEMINI_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GEMINI_ATTEMPT_TIMEOUT_MS);
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: requestBody,
          signal: controller.signal,
        });

        // Gemini puede devolver 429 por un límite momentáneo por minuto; un único
        // reintento breve evita que un pico pasajero se convierta en fallo visible.
        const temporaryProviderError = response.status === 408
          || response.status === 429
          || response.status >= 500;
        if (!temporaryProviderError || attempt === GEMINI_ATTEMPTS) break;

        console.warn(`Gemini respondió HTTP ${response.status}; se reintentará una vez.`);
        try { await response.body?.cancel(); } catch { /* Se libera el primer intento antes de reintentar. */ }
        response = null;
      } catch (error) {
        requestError = error;
        if (attempt === GEMINI_ATTEMPTS) break;
        console.warn('No se completó el primer intento con Gemini; se reintentará una vez.');
      } finally {
        clearTimeout(timeout);
      }

      await wait(500);
    }

    if (!response) {
      const timedOut = requestError instanceof Error && requestError.name === 'AbortError';
      return jsonResponse(timedOut ? 504 : 502, {
        error: timedOut ? 'Gemini tardó demasiado incluso después de reintentar.' : 'No se pudo completar la solicitud a Gemini después de reintentar.',
      });
    }

    if (!response.ok) {
      let providerCode: string | null = null;
      try {
        const providerError = await response.json();
        if (typeof providerError?.error?.status === 'string') providerCode = providerError.error.status;
      } catch {
        // Google puede responder sin un cuerpo JSON legible.
      }
      console.error(`Gemini respondió con HTTP ${response.status}${providerCode ? ` (${providerCode})` : ''}.`);
      return jsonResponse(502, {
        error: 'Gemini rechazó la solicitud.',
        providerStatus: response.status,
        providerCode,
      });
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || !text.trim()) {
      return jsonResponse(502, { error: 'El servicio de evaluación devolvió una respuesta vacía.' });
    }
    return jsonResponse(200, { text: text.slice(0, 8_000) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return jsonResponse(timedOut ? 504 : 502, {
      error: timedOut ? 'La evaluación tardó demasiado. Inténtalo de nuevo.' : 'No se pudo completar la evaluación.',
    });
  }
});
