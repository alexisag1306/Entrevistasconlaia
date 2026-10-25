-- Base de datos completa para SimulaEntrevista (Supabase/PostgreSQL).
-- REINICIO DESTRUCTIVO: elimina perfiles de la app, sesiones, respuestas,
-- preguntas anteriores y contadores diarios de IA. No elimina auth.users.
-- Ejecutar una vez en el SQL Editor de Supabase para crear/reemplazar el esquema.
-- Incluye 119 preguntas originales calibradas por nivel, RLS e infraestructura de cuota para Gemini.
-- Son preguntas de práctica propias, informadas por criterios públicos; no son preguntas oficiales ni confidenciales de empresas.
-- Referencias: Microsoft Careers (technical-interviewing), Amazon Jobs (TPM interview prep),
-- PostgreSQL (Using EXPLAIN) y OWASP Top 10:2025.
-- https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing
-- https://amazon.jobs/content/en/how-we-hire/tpm-interview-prep
-- https://www.postgresql.org/docs/current/using-explain.html
-- https://top10.owasp.org/2025/
-- Después de la base, configura GEMINI_API_KEY como secreto y despliega
-- supabase/functions/generate-feedback (la clave no debe ir en la base ni en VITE_*).

BEGIN;

SET LOCAL search_path TO public;

DROP FUNCTION IF EXISTS public.consume_ai_usage_limit(uuid, integer);

DROP TABLE IF EXISTS public.ai_usage_daily CASCADE;

-- LIMPIEZA INICIAL
-- ══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS session_responses   CASCADE;
DROP TABLE IF EXISTS interview_sessions  CASCADE;
DROP TABLE IF EXISTS interview_questions CASCADE;
DROP TABLE IF EXISTS profiles            CASCADE;

-- ══════════════════════════════════════════════════════════════
-- TABLAS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         text DEFAULT '',
  career_field      text DEFAULT '',
  experience_level  text DEFAULT 'junior',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE interview_questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category         text NOT NULL DEFAULT 'general',
  question_text    text NOT NULL,
  difficulty       text NOT NULL DEFAULT 'media',
  tips             text DEFAULT '',
  phase            integer NOT NULL DEFAULT 2,
  role             text NOT NULL DEFAULT 'general',
  experience_level text NOT NULL DEFAULT 'todos'
);

ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_questions_authenticated" ON interview_questions;
CREATE POLICY "select_questions_authenticated" ON interview_questions FOR SELECT
  TO authenticated USING (true);

CREATE TABLE interview_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mode           text NOT NULL DEFAULT 'text',
  role_focus     text NOT NULL DEFAULT 'general',
  session_type   text NOT NULL DEFAULT 'mixta',
  question_count integer NOT NULL DEFAULT 10,
  question_ids   uuid[] NOT NULL DEFAULT '{}',
  current_question_index integer NOT NULL DEFAULT 0,
  experience_level text NOT NULL DEFAULT 'junior',
  status         text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  started_at     timestamptz DEFAULT now(),
  completed_at   timestamptz,
  abandoned_at   timestamptz
);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON interview_sessions;
CREATE POLICY "select_own_sessions" ON interview_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON interview_sessions;
CREATE POLICY "insert_own_sessions" ON interview_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON interview_sessions;
CREATE POLICY "update_own_sessions" ON interview_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON interview_sessions;
CREATE POLICY "delete_own_sessions" ON interview_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE session_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id      uuid REFERENCES interview_questions(id) ON DELETE SET NULL,
  question_text    text NOT NULL,
  response_text    text DEFAULT '',
  response_mode    text NOT NULL DEFAULT 'text',
  ai_feedback      text DEFAULT '',
  ai_score         integer DEFAULT 0,
  ai_tips          text DEFAULT '',
  duration_seconds integer DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  CONSTRAINT unique_response_per_question UNIQUE (session_id, question_id)
);

ALTER TABLE session_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_responses" ON session_responses;
CREATE POLICY "select_own_responses" ON session_responses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_responses" ON session_responses;
CREATE POLICY "insert_own_responses" ON session_responses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_responses" ON session_responses;
CREATE POLICY "update_own_responses" ON session_responses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_responses" ON session_responses;
CREATE POLICY "delete_own_responses" ON session_responses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_questions_phase        ON interview_questions(phase);
CREATE INDEX idx_questions_role         ON interview_questions(role);
CREATE INDEX idx_questions_exp_level    ON interview_questions(experience_level);
CREATE INDEX idx_questions_category     ON interview_questions(category);
CREATE INDEX idx_sessions_user_id       ON interview_sessions(user_id);
CREATE INDEX idx_sessions_user_status    ON interview_sessions(user_id, status, started_at DESC);
CREATE INDEX idx_responses_session_id   ON session_responses(session_id);
CREATE INDEX idx_responses_user_id      ON session_responses(user_id);

-- ══════════════════════════════════════════════════════════════


-- Límite de uso de evaluaciones generativas

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_daily FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_daily TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_usage_limit(p_user_id uuid, p_daily_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_daily_limit < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, usage_date, request_count)
  VALUES (p_user_id, (now() AT TIME ZONE 'UTC')::date, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET request_count = public.ai_usage_daily.request_count + 1
    WHERE public.ai_usage_daily.request_count < p_daily_limit;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_usage_limit(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_usage_limit(uuid, integer) TO service_role;



-- Catálogo profesional de preguntas

DELETE FROM public.interview_questions;

INSERT INTO public.interview_questions
  (category, question_text, difficulty, tips, phase, role, experience_level)
VALUES
-- Apertura: contexto, contribución individual, decisiones y resultados.
('apertura','Elige un proyecto de software que represente bien tu trabajo. ¿Qué necesidad resolvía, quién lo utilizó y qué parte construiste tú?','media','Busca contexto de uso, responsabilidad individual y evidencia del resultado. Distingue lo que hizo la persona de lo que hizo el equipo.',1,'general','todos'),
('apertura','Cuéntame de una mejora técnica que hayas hecho en un proyecto académico o laboral. ¿Qué problema observaste y cómo comprobaste que la mejora funcionó?','media','Evalúa problema observado, hipótesis, cambio realizado y comparación antes/después. Acepta métricas, pruebas reproducibles o evidencia de usuarios.',1,'general','todos'),
('apertura','Describe una decisión de diseño que tomaste en un proyecto. ¿Qué alternativas consideraste y qué costo aceptaste con la opción elegida?','media','Busca alternativas reales, criterios de decisión y un trade-off explícito. Una respuesta sólida reconoce límites y no presenta una opción como universal.',1,'general','todos'),
('apertura','¿Qué componente de un sistema que construiste te resultó más difícil de mantener y qué cambiarías hoy?','media','Evalúa autocrítica técnica, causa concreta y una mejora viable. Distingue una reflexión informada de una respuesta retrospectiva sin evidencia.',1,'general','todos'),
('apertura','Cuéntame cómo pasaste de una necesidad de usuario a una solución técnica en uno de tus proyectos.','media','Busca preguntas de descubrimiento, restricciones, validación con usuario y ajustes durante el desarrollo.',1,'general','todos'),
('apertura','¿Qué concepto técnico aprendiste recientemente y cómo verificaste que podías aplicarlo de forma correcta?','fácil','Busca una fuente o práctica concreta, un experimento pequeño y una explicación de cuándo usaría el concepto.',1,'general','todos'),
('apertura','¿Qué tipo de problemas de software te interesa resolver y qué experiencia concreta respalda ese interés?','fácil','Relaciona motivación con experiencia verificable; evita evaluar afinidad personal o estilo de comunicación como sustituto de competencia.',1,'general','todos'),
('apertura','Presenta un proyecto en dos minutos como si hablaras con una persona técnica que no conoce el producto.','media','Evalúa claridad sobre objetivo, arquitectura a alto nivel, contribución y resultado; no requiere jerga ni un producto de empresa.',1,'general','todos'),

-- Conductuales: estructura STAR y evidencia concreta, sin exigir experiencia laboral previa.
('conductual','Háblame de una ocasión en la que un plazo cambió y tu equipo no podía completar todo el alcance. ¿Cómo renegociaste prioridades y qué entregaron?','media','Evalúa situación y responsabilidad, priorización explícita, comunicación temprana, resultado verificable y aprendizaje. Proyectos escolares también cuentan.',2,'general','todos'),
('conductual','Cuéntame de un desacuerdo técnico con otra persona. ¿Qué evidencia usaste para llegar a una decisión y cómo terminó la colaboración?','media','Busca escucha, criterios comprobables, comparación de opciones y resultado del equipo. No premies ganar la discusión.',2,'general','todos'),
('conductual','Describe un error tuyo que afectó un proyecto. ¿Cómo lo detectaste, qué hiciste para reducir el impacto y qué cambiaste después?','media','Busca responsabilidad sin culpar, contención del impacto, comunicación, causa raíz y una prevención concreta.',2,'general','todos'),
('conductual','Háblame de un requisito ambiguo que recibiste. ¿Qué preguntas hiciste antes de implementar y qué supuesto validaste?','media','Evalúa aclaración de usuarios, restricciones y criterios de aceptación. La respuesta debe nombrar el supuesto validado y su efecto.',2,'general','todos'),
('conductual','Cuéntame de una ocasión en la que tuviste que aprender una tecnología nueva para resolver una necesidad concreta. ¿Cómo organizaste el aprendizaje?','fácil','Busca objetivo, fuentes fiables, prueba pequeña, aplicación y resultado; no confundas familiaridad con una tecnología con capacidad de aprendizaje.',2,'general','todos'),
('conductual','Describe una retroalimentación difícil que recibiste sobre tu código o forma de trabajar. ¿Qué cambiaste y qué resultado observaste?','media','Evalúa apertura, comprensión de la observación, acción posterior y evidencia de cambio; evita exigir que la persona acepte toda crítica sin criterio.',2,'general','todos'),
('conductual','¿Cómo explicaste un riesgo técnico a una persona no técnica que necesitaba tomar una decisión? Da un ejemplo y el resultado.','media','Busca traducción a impacto, opciones y consecuencias, además de confirmar comprensión. No puntúes por usar términos técnicos.',2,'general','todos'),
('conductual','Cuéntame de dos tareas urgentes que competían por tu tiempo. ¿Cómo decidiste el orden y cómo comunicaste lo que quedaría pendiente?','media','Busca criterio de impacto, dependencia o riesgo, comunicación de límites y seguimiento; una lista de tareas sin decisión no basta.',2,'general','todos'),
('conductual','Háblame de una ocasión en la que ayudaste a una compañera o compañero que estaba bloqueado. ¿Qué hiciste y qué pudo hacer después?','fácil','Evalúa diagnóstico del bloqueo, ayuda que desarrolla autonomía y resultado; no presupongas que ayudar significa resolver el trabajo por la otra persona.',2,'general','todos'),
('conductual','Describe una decisión en la que tuviste que equilibrar calidad técnica y fecha de entrega. ¿Qué riesgo aceptaste y cómo lo controlaste?','media','Busca alcance recortado o mitigación explícita, criterio de calidad mínimo y seguimiento del riesgo después de entregar.',2,'general','todos'),
('conductual','Cuéntame de un experimento o propuesta que no produjo el resultado esperado. ¿Qué señal te hizo cambiar de rumbo?','media','Evalúa hipótesis, señal observada, decisión y aprendizaje. Una respuesta profesional puede describir un resultado negativo sin ocultarlo.',2,'general','todos'),
('conductual','Háblame de una mejora que propusiste aunque no fuera parte explícita de tus tareas. ¿Cómo convenciste al equipo y qué cambió?','media','Busca una necesidad concreta, evidencia, colaboración y efecto. No confundas iniciativa con trabajar sin autorización o ignorar prioridades.',2,'general','todos'),
('conductual','Describe una ocasión en la que detectaste un riesgo de privacidad o seguridad. ¿Cómo lo comunicaste y qué medida se tomó?','difícil','Evalúa contención responsable, comunicación por el canal adecuado, evidencia y protección de personas; no solicites detalles confidenciales de empleadores.',2,'general','todos'),
('conductual','Cuéntame de una situación en la que una prueba o revisión de código encontró un defecto que no habías visto. ¿Cómo respondiste?','fácil','Busca colaboración, análisis de causa, corrección y prueba de regresión; no premies defensividad ni atribución automática de culpa.',2,'general','todos'),
('conductual','Relata una ocasión en la que cambiaste de opinión después de revisar datos, pruebas o comentarios de usuarios.','media','Evalúa qué evidencia cambió la postura, qué decisión tomó y cómo comunicó el cambio.',2,'general','todos'),
('conductual','Cuéntame de una dependencia externa que retrasó tu trabajo. ¿Qué alternativas evaluaste y cómo mantuviste informado al equipo?','media','Busca plan alternativo, gestión de dependencias, comunicación con fechas realistas y registro de decisiones.',2,'general','todos'),
('conductual','Describe una ocasión en la que tuviste que colaborar con alguien cuyo estilo de trabajo era distinto al tuyo. ¿Qué ajustaste?','fácil','Evalúa adaptación mutua, acuerdos de trabajo y resultado compartido; evita estereotipos sobre estilos o personalidades.',2,'general','todos'),

-- ISC general: algoritmos, sistemas, redes, control de versiones, seguridad y pruebas.
('tecnica','Un servicio recibe cientos de miles de eventos y debe detectar duplicados por identificador antes de guardarlos. ¿Qué estructura usarías y cómo estimas tiempo y memoria?','media','Busca aclarar si el orden importa, elegir una estructura por identificador, analizar complejidad y explicar límites de memoria o persistencia.',3,'general','todos'),
('tecnica','Un endpoint procesa una lista y compara cada elemento con todos los demás. El tiempo crece mucho al duplicar los datos. ¿Cómo diagnosticarías y mejorarías el algoritmo?','media','Evalúa complejidad actual, medición reproducible, alternativa algorítmica y validación de resultados. Solicita análisis de tiempo y memoria.',3,'general','todos'),
('tecnica','Dos solicitudes simultáneas actualizan el mismo saldo. ¿Qué secuencia puede producir una pérdida de actualización y cómo la evitarías?','difícil','Busca explicar la carrera con un intercalado concreto y comparar transacción, bloqueo optimista o pesimista según el caso.',3,'general','todos'),
('tecnica','Una aplicación devuelve errores 502 de forma intermitente. ¿Qué revisarías primero entre cliente, red, proxy y servicio de origen?','media','Evalúa diagnóstico por capas, correlación temporal, códigos y trazas. Debe distinguir hipótesis de evidencia antes de cambiar configuración.',3,'general','todos'),
('tecnica','En una API, una persona autenticada cambia el identificador de un recurso en la URL y puede leer datos de otra cuenta. ¿Qué control falta y dónde lo aplicarías?','difícil','Busca autorización por objeto en el servidor, propiedad del recurso y prueba negativa con dos cuentas. Autenticación por sí sola no basta.',3,'general','todos'),
('tecnica','Dos ramas modificaron el mismo módulo y Git marca un conflicto. ¿Cómo resolverías el conflicto sin perder la intención de ninguno de los cambios?','fácil','Busca inspección de ambas versiones, comprensión del comportamiento esperado, resolución consciente y ejecución de pruebas antes del commit.',3,'general','todos'),
('tecnica','Diseña pruebas para una función que calcula el promedio de una lista de puntuaciones. ¿Qué casos límite y propiedades verificarías?','fácil','Busca lista vacía, un elemento, límites, valores inválidos y casos representativos. Debe explicar el resultado esperado, no solo enumerar pruebas.',3,'general','todos'),
('tecnica','Un proceso consume memoria de forma continua mientras atiende solicitudes. ¿Cómo distinguirías una fuga de memoria de una carga legítima y qué medirías?','media','Busca tendencia bajo carga controlada, heap y objetos retenidos, métricas por solicitud y comparación después de liberar referencias.',3,'general','todos'),
('tecnica','Un cliente reintenta una solicitud cuando pierde conexión después de enviar un pago. ¿Cómo evitarías que el servidor cobre dos veces?','media','Evalúa clave de idempotencia, persistencia transaccional del resultado y comportamiento ante repetición o timeout.',3,'general','todos'),
('tecnica','Después de desplegar una versión, aumentan los errores pero no hay suficiente información para encontrar la causa. ¿Qué instrumentación agregarías?','media','Busca logs estructurados, métricas por ruta y versión, trazas correlacionadas, datos sin secretos y una alerta accionable.',3,'general','todos'),
('tecnica','Un sistema debe almacenar sesiones activas que expiran y consultarse por usuario. ¿Qué modelo y mecanismo de expiración elegirías y por qué?','media','Evalúa patrón de acceso, expiración, consistencia requerida y costo operativo. La respuesta puede comparar memoria, caché y base persistente.',3,'general','todos'),
('tecnica','Una solución funciona para el caso normal, pero falla con entradas vacías y tamaños extremos. ¿Cómo ordenarías tu análisis y tu batería de pruebas?','fácil','Busca límites, invariantes, entradas inválidas, complejidad y pruebas de regresión. Debe explicar qué significa el comportamiento correcto.',3,'general','todos'),
('tecnica','Explica cuándo ejecutarías trabajo en un proceso separado y cuándo en un hilo dentro del mismo proceso para una tarea de servidor.','media','Evalúa memoria compartida, aislamiento, paralelismo, costo de comunicación y características de carga; no aceptes una regla absoluta.',3,'general','todos'),
('tecnica','Diseña un acortador de enlaces que debe responder rápido y evitar colisiones de códigos. ¿Qué componentes y restricciones aclararías primero?','difícil','Busca requisitos de lectura/escritura, generación única, persistencia, caché, redirección y abuso. Evalúa trade-offs, no una arquitectura única.',3,'general','todos'),

-- Desarrollo web: rendimiento medible, accesibilidad, React, seguridad y experiencia de usuario.
('tecnica','Una tabla React con 10,000 filas se vuelve lenta al escribir en un filtro. ¿Cómo localizarías el cuello de botella antes de optimizarla?','media','Busca perfilado, tamaño de datos y renders; considera filtrado eficiente, virtualización y debounce solo si la medición lo justifica.',3,'web','todos'),
('tecnica','Después de un cambio visual empeoran LCP, INP y CLS. ¿Qué representa cada métrica y qué revisarías para encontrar la causa?','difícil','Debe diferenciar carga del contenido principal, respuesta a interacción y estabilidad visual; propone medición y una hipótesis por métrica.',3,'web','todos'),
('tecnica','Un componente obtiene datos cuando cambia un parámetro de ruta. El usuario navega rápido y aparece una respuesta vieja. ¿Cómo evitas la condición de carrera y limpias el efecto?','difícil','Busca cancelar o ignorar solicitudes obsoletas, dependencias correctas y limpieza del efecto al cambiar de ruta o desmontar.',3,'web','todos'),
('tecnica','Diseña el estado de una pantalla de búsqueda cuando carga, no encuentra resultados, falla la red o muestra datos antiguos. ¿Cómo mantendrías cada estado accesible?','media','Evalúa estados explícitos, mensajes accionables, foco, etiquetas y recuperación; distinguir vacío de error es fundamental.',3,'web','todos'),
('tecnica','Un usuario puede guardar texto que luego se muestra en una página. ¿Qué riesgos de XSS revisarías y cómo mantendrías el contenido seguro?','difícil','Busca escape por contexto, evitar HTML arbitrario y sanitizar solo si se necesita HTML. Incluye prueba con una entrada maliciosa controlada.',3,'web','todos'),
('tecnica','Una página web tarda en mostrar su contenido principal en conexiones lentas. ¿Cómo separarías el peso de JavaScript, las imágenes y las llamadas de red?','media','Busca medir transferencia y tiempo por recurso, inspeccionar cascada de red y probar compresión, formatos, división de código y prioridad.',3,'web','todos'),
('tecnica','Un formulario se envía dos veces cuando el usuario hace doble clic o la conexión responde tarde. ¿Qué protegerías en el navegador y en el servidor?','media','Evalúa estado de envío deshabilitado, idempotencia del servidor y comunicación del resultado. La defensa solo visual no evita duplicados.',3,'web','todos'),
('tecnica','Un diseño de escritorio deja tarjetas muy angostas en una ventana pequeña. ¿Qué reglas usarías para reorganizarlo sin provocar desplazamiento horizontal?','fácil','Busca layout fluido, puntos de quiebre por contenido, grid/flex con mínimos adecuados y pruebas con zoom y texto largo.',3,'web','todos'),
('tecnica','¿Cómo probarías un formulario React que valida datos y envía una solicitud, incluyendo el caso de error del servidor?','media','Busca pruebas de comportamiento accesible, validación, envío único y estados de carga/error. Explica qué cubriría una prueba unitaria y una de integración.',3,'web','todos'),
('tecnica','Un usuario vuelve a una página y ve contenido obsoleto por caché. ¿Qué estrategia de caché elegirías para HTML, JavaScript y datos de API?','difícil','Evalúa recursos versionados, políticas distintas por tipo, invalidación y consistencia. Debe identificar qué dato puede ser obsoleto.',3,'web','todos'),
('tecnica','Una aplicación solo se puede usar con mouse. ¿Qué revisarías para que el flujo principal funcione con teclado y lector de pantalla?','media','Busca orden de tabulación, foco visible, etiquetas, semántica, anuncios de cambios y operación sin gestos de puntero.',3,'web','todos'),
('tecnica','Una llamada del navegador a la API falla por CORS. ¿Qué función cumple CORS y qué configuración segura revisarías en el servidor?','media','Busca entender que CORS es una política del navegador, permitir orígenes necesarios y no tratarlo como autenticación o autorización.',3,'web','todos'),
('tecnica','Un error solo ocurre en producción y afecta a una ruta. ¿Qué datos de frontend registrarías para reproducirlo sin exponer información personal?','media','Evalúa versión, ruta, tipo de error, correlación y consentimiento; evita tokens, respuestas completas y datos sensibles en logs.',3,'web','todos'),
('tecnica','Un navegador antiguo no soporta una función de la interfaz. ¿Cómo decidirías entre fallback, polyfill y bloquear esa acción?','media','Busca matriz de soporte, criticidad de la función, costo y alternativa entendible; el usuario debe conservar un camino útil.',3,'web','todos'),

-- Backend y APIs: autorización, concurrencia, desempeño, resiliencia y operación.
('tecnica','Una API crea órdenes y el cliente puede repetir la solicitud tras un timeout. ¿Cómo garantizas que se cree una sola orden?','media','Evalúa idempotency key, restricción única y transacción. Explica qué respuesta devuelve el servidor ante una repetición.',3,'backend','todos'),
('tecnica','Un endpoint recibe /users/{id}/invoices/{invoiceId}. ¿Cómo compruebas que la factura pertenece al usuario autenticado?','difícil','Busca autorización a nivel de objeto en cada solicitud, asociación verificable en la consulta y prueba entre cuentas distintas.',3,'backend','todos'),
('tecnica','Una consulta de una ruta crítica tarda varios segundos. ¿Qué información te daría EXPLAIN ANALYZE y qué precauciones tendrías al ejecutarlo?','difícil','Evalúa plan, filas estimadas/reales, lecturas y operaciones costosas; en producción considera el efecto de ejecutar la consulta.',3,'backend','todos'),
('tecnica','Un proceso en segundo plano falla temporalmente al llamar a otro servicio. ¿Cómo diseñas reintentos, espera, límite y manejo de mensajes que fallan siempre?','difícil','Busca backoff con jitter, máximo de intentos, idempotencia, cola de fallidos y observabilidad; evita reintentos infinitos.',3,'backend','todos'),
('tecnica','Un endpoint público recibe ráfagas que degradan el servicio. ¿Dónde aplicarías límites de solicitudes y qué respuesta vería el cliente?','media','Evalúa límite por usuario o clave, ventana, almacenamiento compartido y HTTP 429 con política de reintento.',3,'backend','todos'),
('tecnica','Una tabla crece y los clientes descargan miles de registros con offset. ¿Cómo rediseñarías la paginación y qué orden estable necesitas?','media','Busca cursor basado en clave ordenable y desempate único; explica ventajas y límites frente a offset.',3,'backend','todos'),
('tecnica','Debes agregar una columna obligatoria a una tabla grande sin detener la API. ¿Cómo dividirías la migración y el despliegue?','difícil','Evalúa expansión y contracción, compatibilidad temporal, backfill por lotes, validación y plan de reversa.',3,'backend','todos'),
('tecnica','Una caché reduce carga pero devuelve permisos antiguos después de un cambio de rol. ¿Qué datos no cachearías y cómo invalidarías lo demás?','difícil','Busca separar datos públicos de autorización, definir TTL e invalidación, y fallar de forma segura ante cambios de permisos.',3,'backend','todos'),
('tecnica','Una API tiene latencia alta solo en algunas solicitudes. ¿Qué métricas, trazas y campos de log agregarías para localizar el tramo lento?','media','Busca latencia por percentiles, dependencia externa, identificador de correlación y logs sin secretos ni contenido personal.',3,'backend','todos'),
('tecnica','Un servicio empieza a recibir más solicitudes de las que puede procesar. ¿Cómo evitarías que la cola y el uso de memoria sigan creciendo?','difícil','Evalúa límites de concurrencia, backpressure, colas acotadas, rechazo controlado y degradación; los límites deben ser observables.',3,'backend','todos'),
('tecnica','Un proveedor envía webhooks de pago. ¿Cómo verificas autenticidad y evitas procesar dos veces un evento repetido?','difícil','Busca firma sobre el cuerpo exacto, protección contra replay, idempotencia por identificador y registro transaccional del evento.',3,'backend','todos'),
('tecnica','Dos procesos actualizan el mismo registro con información leída en momentos distintos. ¿Cómo detectarías y resolverías una actualización perdida?','difícil','Evalúa versión optimista, bloqueo o transacción según conflicto; debe describir el caso concurrente y su manejo.',3,'backend','todos'),
('tecnica','¿Qué información conservarías en logs de una petición que falla y qué datos excluirías para proteger a la persona usuaria?','media','Busca código de error, ruta, duración y correlación; excluye contraseñas, tokens, audio y respuestas completas.',3,'backend','todos'),
('tecnica','Diseña una respuesta de error para una API que pueda ayudar al cliente a recuperarse sin exponer detalles internos.','fácil','Evalúa códigos HTTP coherentes, mensaje estable, identificador de seguimiento y separación de detalle interno del mensaje público.',3,'backend','todos'),

-- Bases de datos: modelado, planes, índices, transacciones, recuperación y evolución.
('tecnica','Modela una tienda con pedidos, productos, partidas y direcciones de entrega. ¿Qué relaciones y restricciones evitarían datos inconsistentes?','media','Busca entidades y claves foráneas, restricciones de integridad y una decisión explícita sobre conservar la dirección histórica del pedido.',3,'bd','todos'),
('tecnica','Una consulta filtra por usuario y estado y luego ordena por fecha. ¿Qué revisarías antes de proponer un índice compuesto?','media','Evalúa consulta real, selectividad, orden de columnas, costo de escritura y EXPLAIN. No asumas que más índices siempre mejoran.',3,'bd','todos'),
('tecnica','EXPLAIN muestra un escaneo secuencial en una tabla grande. ¿Qué evidencia necesitas para saber si es un problema y qué revisarías después?','difícil','Busca filas estimadas y reales, selectividad, buffers y tiempo; un escaneo secuencial puede ser correcto si devuelve muchas filas.',3,'bd','todos'),
('tecnica','Dos usuarios intentan reservar el último lugar disponible al mismo tiempo. ¿Qué protección debe vivir en la base de datos?','difícil','Evalúa transacción y restricción o bloqueo que haga atómica la reserva; valida el resultado con una prueba concurrente.',3,'bd','todos'),
('tecnica','En una transacción de lectura y actualización, ¿qué anomalía puede permitir el nivel de aislamiento actual y qué nivel o mecanismo elegirías?','difícil','Debe describir una anomalía con una secuencia concreta y justificar el nivel de aislamiento por consistencia y costo.',3,'bd','todos'),
('tecnica','Dos transacciones bloquean filas en orden distinto y se produce un deadlock. ¿Cómo lo diagnosticas y qué cambios reducen su frecuencia?','difícil','Busca revisar el grafo o logs de bloqueo, ordenar accesos de forma consistente y reintentar de forma acotada la transacción abortada.',3,'bd','todos'),
('tecnica','Necesitas agregar una columna obligatoria a una tabla con millones de filas. ¿Cómo lo desplegarías para mantener compatibilidad con versiones anteriores de la aplicación?','difícil','Evalúa despliegue por fases, default, backfill por lotes, validación y activación de NOT NULL después de rellenar datos.',3,'bd','todos'),
('tecnica','Una consulta con OFFSET alto se vuelve cada vez más lenta. ¿Cómo implementarías paginación por cursor sin perder registros entre páginas?','media','Busca un orden determinista con desempate único y cursor compuesto. Explica cómo se comporta si se insertan filas entre lecturas.',3,'bd','todos'),
('tecnica','Un campo JSON contiene atributos que ahora se filtran y relacionan con frecuencia. ¿Qué señales indicarían que conviene normalizarlo?','media','Evalúa patrones de consulta, integridad, evolución del esquema e índices; admite una decisión híbrida bien justificada.',3,'bd','todos'),
('tecnica','¿Cómo diseñarías una copia de seguridad y una prueba de restauración para una base de la que depende un sistema de pedidos?','media','Busca frecuencia, alcance, RPO/RTO, cifrado, acceso y una restauración ensayada; una copia sin prueba no demuestra recuperabilidad.',3,'bd','todos'),
('tecnica','Una tabla de eventos crece rápidamente. ¿Qué diferencia práctica hay entre particionarla y distribuirla entre varios servidores?','difícil','Evalúa límites operativos, patrón por fecha/clave, mantenimiento, consultas y costo de coordinación; evita presentar partición como solución automática.',3,'bd','todos'),
('tecnica','Un negocio solicita borrar datos personales después de cierto plazo, pero conservar métricas agregadas. ¿Cómo separarías identificación, retención y anonimización?','difícil','Busca minimización, vínculos entre tablas, política verificable, borrado en cascada o anonimización y pruebas de recuperación.',3,'bd','todos'),
('tecnica','Un mismo dato se guarda en varias tablas y las actualizaciones empiezan a divergir. ¿Cómo detectarías anomalías de inserción, actualización y borrado?','media','Evalúa dependencias funcionales y normalización hasta el nivel necesario; justificar cualquier desnormalización por una carga real.',3,'bd','todos'),
('tecnica','Una consulta combina varias tablas y devuelve demasiadas filas. ¿Cómo investigarías cardinalidad, estadísticas y orden de joins antes de cambiar el esquema?','difícil','Busca plan de ejecución, estimaciones frente a filas reales, filtros y estadísticas actualizadas; propone medir el cambio con datos representativos.',3,'bd','todos'),

-- Cierre: reflexión, comunicación de riesgos y siguiente aprendizaje.
('cierre','Si tuvieras una semana adicional para mejorar el proyecto que presentaste, ¿qué cambiarías primero y cómo medirías el efecto?','media','Busca priorización por valor o riesgo, una métrica verificable y límites del cambio propuesto.',4,'general','todos'),
('cierre','¿Qué decisión técnica de esta entrevista explicarías de otra manera después de reflexionar?','media','Evalúa autocrítica concreta, evidencia que faltó y cómo mejoraría la explicación sin inventar resultados.',4,'general','todos'),
('cierre','Antes de liberar una función que guarda respuestas de usuarios, ¿qué riesgo comprobarías primero y cómo lo probarías?','media','Busca privacidad, autorización, retención o seguridad, una prueba concreta y un criterio de salida.',4,'general','todos'),
('cierre','¿Qué indicador revisarías durante la primera semana de una nueva API y qué acción tomarías si empeora?','media','Busca indicador alineado con usuario, umbral o comparación y una respuesta operativa viable.',4,'general','todos'),
('cierre','¿Qué pregunta harías al equipo para entender cómo toma decisiones de arquitectura y cómo valida los cambios en producción?','fácil','Evalúa curiosidad por prácticas y contexto del equipo; no existe una respuesta única ni debe puntuarse por coincidir con una empresa.',4,'general','todos'),
('cierre','¿Qué supuesto de tu solución te gustaría validar con usuarios o con datos reales antes de continuar?','media','Busca un supuesto explícito, método de validación y decisión que dependería del resultado.',4,'general','todos'),
('cierre','¿Qué riesgo dejarías documentado si tu solución tuviera que salir hoy y qué mitigación propondrías?','media','Evalúa transparencia, impacto, probabilidad, mitigación y responsable; no se espera afirmar que un sistema carece de riesgos.',4,'general','todos'),
('cierre','Después de esta práctica, ¿qué habilidad concreta vas a entrenar y qué evidencia te dirá que mejoraste?','fácil','Busca un objetivo acotado, práctica repetible y una señal observable de progreso.',4,'general','todos');

-- Preguntas conductuales calibradas por nivel: no dependen de haber trabajado en una empresa.
INSERT INTO public.interview_questions
  (category, question_text, difficulty, tips, phase, role, experience_level)
VALUES
('conductual','Describe un reto de un proyecto escolar, personal o de prácticas en el que te hayas bloqueado. ¿Cómo encontraste una forma de avanzar y qué aprendiste?','fácil','Admite proyectos académicos o personales. Evalúa el obstáculo, la acción propia, el apoyo o recursos buscados y el aprendizaje; no exige un resultado de negocio.',2,'general','junior'),
('conductual','Cuéntame de una ocasión en que recibiste comentarios sobre una solución que construiste. ¿Qué decidiste cambiar y cómo comprobaste si la mejora ayudó?','media','Busca apertura crítica, decisión propia y evidencia de seguimiento; no es obligatorio que la persona acepte todos los comentarios.',2,'general','junior'),
('conductual','Háblame de una entrega de la que eras responsable y cuyo alcance cambió. ¿Cómo reorganizaste el trabajo y qué resultado obtuvo el equipo?','media','Evalúa autonomía, negociación de alcance, comunicación temprana y resultado. Distingue claramente contribución propia y colectiva.',2,'general','mid'),
('conductual','Describe un desacuerdo sobre una decisión técnica que afectaba una entrega. ¿Qué evidencia compartiste y cómo se resolvió?','media','Busca criterios verificables, escucha, manejo del desacuerdo y decisión final; no premia imponerse ni requiere que la propuesta de la persona prevalezca.',2,'general','mid'),
('conductual','Cuéntame de una decisión técnica en la que orientaste a otras personas. ¿Cómo incorporaste distintas perspectivas y qué efecto tuvo el enfoque elegido?','difícil','Evalúa influencia con contexto, alternativas, participación del equipo y efecto sostenible; no equipara liderazgo únicamente con tener un cargo.',2,'general','senior'),
('conductual','Describe una práctica o estándar que ayudaste a mejorar en un equipo. ¿Qué problema atendía y cómo verificaron que se mantuviera útil?','difícil','Busca problema sistémico, adopción por el equipo, resultado verificable y revisión posterior; evita atribuirse en solitario un cambio colectivo.',2,'general','senior'),

-- Tecnología general: expectativas acordes con la autonomía y el alcance del puesto.
('tecnica','Una función que escribiste devuelve un resultado incorrecto para una entrada límite. ¿Cómo reproducirías el caso, localizarías el problema y comprobarías la corrección?','fácil','Evalúa reproducción, inspección de supuestos, prueba del caso límite y regresión. Acepta ejercicios académicos o personales.',3,'general','junior'),
('tecnica','Debes integrar una biblioteca nueva en un proyecto pequeño. ¿Cómo revisarías su documentación, probarías un caso mínimo y decidirías si es adecuada?','fácil','Busca documentación oficial, prueba aislada, compatibilidad, mantenimiento y una decisión sustentada; no exige conocer previamente la biblioteca.',3,'general','junior'),
('tecnica','Una ruta crítica de una aplicación se degrada tras aumentar el tráfico. ¿Qué medirías y cómo decidirías entre optimizar el código, la consulta o la dependencia externa?','media','Evalúa métricas antes de cambiar, aislamiento del tramo lento, percentiles y comparación después del cambio; las herramientas pueden variar.',3,'general','mid'),
('tecnica','Una entrega requiere un cambio incompatible para varios componentes. ¿Cómo dividirías el despliegue para reducir riesgo y mantener compatibilidad durante la transición?','difícil','Busca fases compatibles, estrategia de migración, observabilidad, reversa y coordinación; permite varias soluciones justificadas.',3,'general','mid'),
('tecnica','Una decisión arquitectónica reduce el costo actual pero puede limitar una necesidad futura. ¿Qué escenarios, costos y señales usarías para decidir?','difícil','Evalúa incertidumbre explícita, costo de cambio, opciones reversibles y evidencia que activaría una revisión; no hay arquitectura única.',3,'general','senior'),
('tecnica','Un sistema presenta fallas intermitentes entre varios servicios. ¿Cómo organizarías el diagnóstico y qué cambio sistémico priorizarías para reducir recurrencia?','difícil','Busca trazabilidad extremo a extremo, hipótesis verificables, impacto, responsables y prevención; distingue contención inmediata de corrección duradera.',3,'general','senior'),

-- Desarrollo web.
('tecnica','Un formulario muestra un mensaje de error pero no indica qué campo necesita atención. ¿Cómo harías que el flujo funcione con teclado y lector de pantalla?','fácil','Busca etiquetas, asociación de errores con campos, foco visible, anuncios accesibles y prueba manual con teclado; no se limita al color.',3,'web','junior'),
('tecnica','Una lista filtrable funciona con pocos elementos, pero se vuelve lenta con datos mayores. ¿Qué medirías primero y qué optimización probarías?','media','Busca perfilado antes de optimizar y alternativas como limitar resultados, virtualización o cálculo eficiente según evidencia.',3,'web','junior'),
('tecnica','Una interfaz muestra datos de una búsqueda anterior cuando se navega rápidamente entre resultados. ¿Cómo evitarías que una respuesta obsoleta reemplace la actual?','media','Evalúa cancelación o descarte de solicitudes antiguas, estado ligado al parámetro vigente y prueba de navegación rápida.',3,'web','mid'),
('tecnica','Una página tarda en mostrar el contenido principal en móviles. ¿Cómo determinarías si la causa es JavaScript, imágenes, estilos o llamadas de red?','media','Busca cascada de red, medición reproducible y optimizaciones específicas por recurso; evita recomendar división de código o compresión sin evidencia.',3,'web','mid'),
('tecnica','Varios equipos construyen interfaces con patrones inconsistentes. ¿Cómo definirías una base compartida que mejore accesibilidad sin bloquear necesidades locales?','difícil','Evalúa principios de diseño, componentes accesibles, gobernanza ligera, versionado y mecanismo para excepciones justificadas.',3,'web','senior'),
('tecnica','Una aplicación web debe cargar rápidamente, funcionar con conectividad inestable y proteger datos personales. ¿Cómo priorizarías las decisiones de arquitectura?','difícil','Busca requisitos y riesgos, degradación útil sin conexión, minimización de datos, límites de caché y medición; permite trade-offs explícitos.',3,'web','senior'),

-- Backend y APIs.
('tecnica','Debes crear una API sencilla para registrar tareas. ¿Qué validarías en la solicitud y qué respuestas devolverías para éxito y datos inválidos?','fácil','Evalúa validación del lado servidor, estructura entendible y códigos HTTP coherentes; no requiere diseñar una plataforma completa.',3,'backend','junior'),
('tecnica','Un cliente reintenta una solicitud después de un tiempo de espera y podría crear un registro duplicado. ¿Cómo harías la operación segura ante repeticiones?','media','Busca idempotencia respaldada por persistencia y una prueba de repetición; un botón deshabilitado en el cliente no es suficiente.',3,'backend','junior'),
('tecnica','Dos solicitudes actualizan el mismo recurso casi al mismo tiempo. ¿Cómo detectarías y resolverías una actualización perdida?','difícil','Evalúa versión optimista, transacción o bloqueo según el conflicto, y explica qué recibe el cliente cuando debe reintentar.',3,'backend','mid'),
('tecnica','Una dependencia externa falla durante periodos breves. ¿Cómo evitarías que los reintentos saturen tu servicio y cómo tratarías los casos persistentes?','difícil','Busca espera incremental con variación, límite de intentos, tiempos máximos, idempotencia, degradación y monitoreo.',3,'backend','mid'),
('tecnica','Un servicio crítico comparte base de datos y recursos con cargas de distinta prioridad. ¿Cómo aislarías fallas y protegerías las operaciones esenciales?','difícil','Evalúa límites de recursos, aislamiento, prioridades, comportamiento degradado y estrategia de recuperación con objetivos explícitos.',3,'backend','senior'),
('tecnica','Necesitas evolucionar una API usada por clientes que no puedes actualizar al mismo tiempo. ¿Cómo desplegarías el cambio y retirarías la versión anterior?','difícil','Busca compatibilidad temporal, medición de adopción, comunicación, periodo de transición y criterio observable para retirar soporte.',3,'backend','senior'),

-- Bases de datos.
('tecnica','En un modelo de pedidos, cada pedido contiene varios productos. ¿Qué tablas y relaciones crearías para representar esas partidas?','fácil','Busca entidades, claves primarias y foráneas, atributos de la partida y una explicación de por qué la relación es de muchos a muchos.',3,'bd','junior'),
('tecnica','Una consulta filtra por usuario y ordena por fecha. ¿Cómo revisarías si necesita un índice y qué costo tendría agregarlo?','media','Evalúa consulta real y plan de ejecución, selectividad y costo de escritura; no presupongas que cualquier índice acelera.',3,'bd','junior'),
('tecnica','Una consulta con varias uniones devuelve muchas más filas de las esperadas. ¿Cómo investigarías cardinalidad, filtros y estimaciones del optimizador?','difícil','Busca comparar filas estimadas y reales, revisar relaciones y estadísticas antes de cambiar índices o esquema.',3,'bd','mid'),
('tecnica','Dos transacciones reservan simultáneamente la última unidad disponible. ¿Qué operación atómica o restricción evitaría confirmar ambas reservas?','difícil','Evalúa transacción con bloqueo o actualización condicional y una protección de integridad en la base; explica cómo probar concurrencia.',3,'bd','mid'),
('tecnica','Una tabla de eventos crece rápidamente y las consultas suelen acotarse por fecha. ¿Qué evaluarías antes de particionar y cómo medirías el beneficio?','difícil','Busca patrón de acceso, mantenimiento, límites de particiones, eliminación de datos y medición del plan; distingue partición de escalado entre servidores.',3,'bd','senior'),
('tecnica','Debes cambiar una tabla grande mientras conviven versiones antiguas y nuevas de la aplicación. ¿Cómo organizarías migración, validación y reversa?','difícil','Evalúa expansión y contracción, cambios compatibles, backfill por lotes, validación y reversa; incluye observabilidad durante la transición.',3,'bd','senior');



DO $$
DECLARE
  question_total integer;
BEGIN
  SELECT count(*) INTO question_total FROM public.interview_questions;
  IF question_total <> 119 THEN
    RAISE EXCEPTION 'Se esperaban 119 preguntas; se insertaron %.', question_total;
  END IF;
END;
$$;

COMMIT;
