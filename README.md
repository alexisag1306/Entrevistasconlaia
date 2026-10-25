# SimulaEntrevista

Aplicación de práctica de entrevistas para Ingeniería en Sistemas Computacionales. La interfaz está organizada por responsabilidad y la lógica compartida de las modalidades vive en `src/lib`.

## Estructura

```text
docs/           Documentos de metodología y producto
public/         Recursos estáticos y marca
src/
  components/   Elementos reutilizables, navegación y retroalimentación
  context/      Sesión y perfil de usuario
  lib/          Acceso a datos, evaluación de IA y lógica compartida de entrevistas
  screens/      Vistas asociadas a las rutas de la aplicación
  styles/       Capas de estilos, en orden de carga
  types/        Tipos de dominio compartidos
tests/          Pruebas de configuración de rutas y selección de preguntas
supabase/
  functions/    Funciones de servidor; aquí se conecta Gemini sin exponer la clave
  database.sql  Esquema, seguridad, cuota y banco completo de preguntas
```

Voz y texto reutilizan `src/lib/interview-questions.ts` para la selección; `src/lib/interview-data.ts` centraliza la carga y creación de sesiones, y `src/lib/session-responses.ts` guarda ambas modalidades con el mismo formato.
Cada sesión conserva su cola de preguntas y posición para poder retomarla; respuestas y retroalimentación completa se pueden consultar desde Resultados y Perfil.
Los estados de carga y los errores reutilizan `src/components/LoadingState.tsx` y `src/components/FlowError.tsx`.
Los documentos de metodología están en `docs/`; `dist/` y `node_modules/` son carpetas generadas/locales, no código fuente.
Las pantallas se cargan por ruta para mantener más ligero el paquete inicial. Las hojas de estilo se separaron por capas en `src/styles/`; consulta su README antes de añadir reglas.

## Base de datos

La única base lista para instalar está en [`supabase/database.sql`](supabase/database.sql). Incluye el esquema actual, las políticas de seguridad, la recuperación de sesiones, el límite de uso de IA y las 119 preguntas profesionales.

Para volver a instalarla, abre el SQL Editor de Supabase, pega el contenido completo de ese archivo y ejecútalo. **Es un reinicio destructivo:** elimina perfiles de la aplicación, sesiones, respuestas, preguntas y contadores diarios de IA; conserva las cuentas de autenticación (`auth.users`).

Para habilitar la evaluación generativa, consulta [`supabase/SETUP_AI.md`](supabase/SETUP_AI.md). Mantén las claves fuera del cliente y de archivos versionados.

## Desarrollo local

```bash
npm install
npm run dev
```

Antes de integrar cambios, ejecuta `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`.

Duplica `.env.example` como `.env.local` y coloca ahí `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Configura también `VITE_PRIVACY_CONTACT_EMAIL` y `VITE_DATA_RETENTION_NOTICE` antes de abrir el producto al público. La clave de Gemini va únicamente en los secretos del servidor de Supabase.
