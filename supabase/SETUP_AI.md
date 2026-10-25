# Base de datos y evaluaciones con IA

`supabase/database.sql` es el único archivo SQL que debes ejecutar para recrear la base completa. Incluye tablas de la app, políticas RLS, recuperación de sesiones, cuota diaria de IA e inserción de las 119 preguntas profesionales.

> **Importante:** es un reinicio destructivo. Borra perfiles de la app, sesiones, respuestas, preguntas y cuotas de IA. No elimina las cuentas de `auth.users`. Ejecútalo solo si estás de acuerdo con perder esos datos.

## Activar evaluaciones con IA

La clave de Gemini no se almacena en PostgreSQL ni en variables `VITE_*`; se guarda como secreto de Edge Functions:

1. En Supabase, configura `GEMINI_API_KEY` como secreto desde el panel o con `supabase secrets set GEMINI_API_KEY=TU_CLAVE`.
2. Desde la raíz del proyecto, despliega la función con `supabase functions deploy generate-feedback`.
3. Elimina `VITE_GEMINI_API_KEY` de tu entorno local y del hosting. Si ya estuvo en un build distribuido, revócala o rótala en Google AI Studio.

La función requiere una sesión válida y limita las evaluaciones a 40 por usuario y día (fecha UTC). Si la clave o la función no están disponibles, la app no asigna una nota falsa: muestra los criterios guardados para esa pregunta e indica que no pudo analizar la respuesta.
