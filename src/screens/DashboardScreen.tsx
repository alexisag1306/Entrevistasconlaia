import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Award, BarChart2, Brain, FileText, Lightbulb, Mic, Play, Trash2,
  MessageSquare, Sparkles, Target,
} from 'lucide-react';
import AnimatedWords from '@/components/AnimatedWords';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { abandonInterviewSession } from '@/lib/interview-data';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { InterviewSession } from '@/types';

interface SessionScore { date: string; avg: number; sessionNum: number; }
interface DashboardTip { text: string; question: string; date: string; }
const MotionLink = motion(Link);

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.03 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
};

export default function DashboardScreen() {
  const { user, profile } = useAuth();
  const motionEnabled = !useReducedMotion();
  const { confirm, dialog } = useConfirmDialog();
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalResponses: 0,
    avgScore: 0,
    scoredResponses: 0,
    recentTips: [] as DashboardTip[],
  });
  const [progressData, setProgressData] = useState<SessionScore[]>([]);
  const [activeSessions, setActiveSessions] = useState<InterviewSession[]>([]);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [abandoningSessionId, setAbandoningSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      setLoading(true);
      setLoadError(null);
      if (!user) {
        if (active) setLoading(false);
        return;
      }

      try {
        const [sessionsResult, responseCountResult, recentResult, activeSessionsResult] = await Promise.all([
          supabase.from('interview_sessions').select('id', { count: 'exact', head: true })
            .eq('user_id', user.id).not('completed_at', 'is', null),
          supabase.from('session_responses').select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase.from('session_responses').select('ai_score, ai_tips, question_text, created_at')
            .eq('user_id', user.id).gt('ai_score', 0)
            .order('created_at', { ascending: false }).limit(50),
          supabase.from('interview_sessions').select('*')
            .eq('user_id', user.id).eq('status', 'in_progress')
            .order('started_at', { ascending: false }).limit(5),
        ]);

        if (sessionsResult.error || responseCountResult.error || recentResult.error || activeSessionsResult.error) {
          throw new Error('No se pudieron cargar las métricas.');
        }

        const recent = recentResult.data ?? [];
        const avg = recent.length > 0
          ? Math.round((recent.reduce((sum, response) => sum + response.ai_score, 0) / recent.length) * 10) / 10
          : 0;
        const tips = recent.filter(response => response.ai_tips?.trim())
          .slice(0, 2)
          .map(response => ({
            text: response.ai_tips.trim(),
            question: response.question_text?.trim() ?? '',
            date: new Date(response.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
          }));

        const { data: sessionData, error: progressError } = await supabase
          .from('interview_sessions').select('id, started_at').eq('user_id', user.id)
          .not('completed_at', 'is', null).order('started_at', { ascending: false }).limit(10);
        if (progressError) throw progressError;

        let scores: SessionScore[] = [];
        if (sessionData?.length) {
          const { data: sessionResponses, error: sessionResponsesError } = await supabase
            .from('session_responses').select('session_id, ai_score')
            .in('session_id', sessionData.map(session => session.id)).gt('ai_score', 0);
          if (sessionResponsesError) throw sessionResponsesError;

          const bySession = new Map<string, number[]>();
          for (const response of sessionResponses ?? []) {
            const values = bySession.get(response.session_id) ?? [];
            values.push(response.ai_score);
            bySession.set(response.session_id, values);
          }
          scores = [...sessionData].reverse().flatMap((session, index) => {
            const sessionScores = bySession.get(session.id) ?? [];
            if (!sessionScores.length) return [];
            return [{
              date: new Date(session.started_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
              avg: Math.round((sessionScores.reduce((sum, value) => sum + value, 0) / sessionScores.length) * 10) / 10,
              sessionNum: index + 1,
            }];
          });
        }

        if (!active) return;
        setStats({
          totalSessions: sessionsResult.count ?? 0,
          totalResponses: responseCountResult.count ?? 0,
          avgScore: avg,
          scoredResponses: recent.length,
          recentTips: tips,
        });
        setProgressData(scores);
        setActiveSessions((activeSessionsResult.data ?? []) as InterviewSession[]);
      } catch {
        if (!active) return;
        setLoadError('No pudimos cargar tus métricas. Revisa tu conexión e inténtalo de nuevo.');
        setProgressData([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadStats();
    return () => { active = false; };
  }, [user, retryCount]);

  const isFirstTime = !loading && !loadError && activeSessions.length === 0 && stats.totalSessions === 0 && stats.totalResponses === 0;
  const firstName = profile?.full_name?.split(' ')[0] || 'ahí';
  const careerField = profile?.career_field || 'Ingeniería en Sistemas Computacionales';

  function resumePath(session: InterviewSession) {
    const params = new URLSearchParams({
      sessionId: session.id,
      role: session.role_focus,
      type: session.session_type,
      count: String(session.question_count),
    });
    return `/${session.mode}?${params.toString()}`;
  }

  async function discardSession(session: InterviewSession) {
    if (!user) return;
    const discard = await confirm({
      eyebrow: 'Sesión guardada',
      title: '¿Descartar esta entrevista?',
      description: 'La sesión se marcará como abandonada y dejará de aparecer entre tus entrevistas pendientes. Las respuestas que guardaste seguirán en tu historial.',
      confirmLabel: 'Descartar entrevista',
      cancelLabel: 'Conservar sesión',
      tone: 'warning',
    });
    if (!discard) return;

    setAbandoningSessionId(session.id);
    setSessionActionError(null);
    const success = await abandonInterviewSession(user.id, session.id);
    if (success) setActiveSessions(current => current.filter(item => item.id !== session.id));
    else setSessionActionError('No pudimos actualizar esta sesión. Inténtalo otra vez.');
    setAbandoningSessionId(null);
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="dashboard-shell">
      {dialog}
      <div className="dashboard-unified-panel">
      <motion.section variants={fadeUp} className="dashboard-hero">
        <div className="hero-copy">
          <p className="hero-kicker">Simulador de entrevista · ISC</p>
          <h1 className="hero-title" aria-label="Mejora la calidad de tus respuestas, una práctica a la vez.">
            <AnimatedWords text="Mejora la calidad de tus respuestas," />{' '}
            <em><AnimatedWords text="una práctica a la vez." /></em>
          </h1>
          <p className="hero-description">
            Hola, {firstName}. Prepara entrevistas de {careerField} con preguntas profesionales, práctica guiada y retroalimentación acorde a tu nivel.
          </p>
          <p className="hero-meta">PREGUNTAS ADAPTADAS A TU PERFIL <span className="mx-2 text-[var(--lime)]">·</span> SESIONES CON IA</p>
        </div>

        <div className="interview-preview" aria-label="Vista de ejemplo de una entrevista por voz">
          <div className="preview-topline">
            <span className="preview-brand"><span className="preview-brand-dot" /> Vista previa · por voz</span>
            <span className="preview-counter">01 / 08</span>
          </div>
          <div className="preview-stage">
            <div className="preview-avatar" aria-hidden="true"><Mic className="h-7 w-7" strokeWidth={1.8} /></div>
            <span className="preview-caption">Entrevistador virtual</span>
            <motion.span
              className="preview-sparkle preview-sparkle--one"
              aria-hidden="true"
              animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.15, 0.8], rotate: [0, 16, 0], y: [0, -5, 0] }}
              transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
            ><Sparkles /></motion.span>
            <motion.span
              className="preview-sparkle preview-sparkle--two"
              aria-hidden="true"
              animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 0.7, 1], rotate: [0, -15, 0] }}
              transition={{ duration: 5.1, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
            ><Sparkles /></motion.span>
          </div>
          <div className="preview-prompt">
            <span className="preview-prompt-label"><Sparkles aria-hidden="true" /> Pregunta de muestra</span>
            <p>Una consulta tarda cada vez más conforme crece la tabla. ¿Qué revisarías primero para encontrar la causa?</p>
          </div>
          <div className="preview-footer">
            <span>Simulación de muestra</span>
            <span className="waveform" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} />)}</span>
          </div>
        </div>
      </motion.section>

      {activeSessions.length > 0 && (
        <motion.section variants={fadeUp} className="dashboard-panel">
          <div className="section-head">
            <div>
              <p className="section-kicker">Tu práctica quedó guardada</p>
              <h2 className="section-title">Retomar una sesión</h2>
            </div>
            <span className="section-note hidden sm:block">Puedes continuar donde te quedaste.</span>
          </div>
          {sessionActionError && <p className="mb-3 text-sm text-red-700" role="alert">{sessionActionError}</p>}
          <div className="space-y-3">
            {activeSessions.map(session => (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] p-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {session.role_focus === 'bd' ? 'Bases de Datos' : session.role_focus === 'web' ? 'Desarrollo Web' : session.role_focus === 'backend' ? 'Backend / APIs' : 'General ISC'}
                    {' · '}{session.mode === 'voice' ? 'Voz' : 'Texto'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Pregunta {Math.min(session.current_question_index + 1, session.question_count)} de {session.question_count}
                    {' · '}{new Date(session.started_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={resumePath(session)} className="flow-primary inline-flex items-center gap-2">
                    <Play className="h-4 w-4" /> Continuar
                  </Link>
                  <button
                    type="button"
                    onClick={() => discardSession(session)}
                    disabled={abandoningSessionId === session.id}
                    className="flow-secondary inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {abandoningSessionId === session.id ? 'Guardando…' : 'Descartar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {loadError ? (
        <section className="dashboard-panel flex flex-wrap items-center justify-between gap-4" role="alert">
          <p className="empty-tip">{loadError}</p>
          <button type="button" onClick={() => setRetryCount(count => count + 1)} className="flow-secondary">Reintentar</button>
        </section>
      ) : isFirstTime ? (
        <motion.div variants={fadeUp} className="first-session-note">
          <div>
            <strong>Tu primera sesión crea tu punto de partida.</strong>
            <span>Completa tu primera práctica para establecer un punto de partida. Después verás tu progreso y recomendaciones aquí.</span>
          </div>
        </motion.div>
      ) : null}

      {!isFirstTime && !loadError && (
        <motion.section variants={fadeUp} className="metric-grid" aria-label="Resumen de práctica">
          {[
            { icon: Target, label: 'Completadas', value: loading ? '—' : String(stats.totalSessions), note: 'Entrevistas terminadas', image: '/images/dashboard/metric-completed.jpg' },
            { icon: MessageSquare, label: 'Respuestas', value: loading ? '—' : String(stats.totalResponses), note: 'Total registrado', image: '/images/dashboard/metric-responses.jpg' },
            { icon: Award, label: 'Promedio reciente', value: loading ? '—' : stats.avgScore > 0 ? String(stats.avgScore) + '/10' : '—', note: stats.scoredResponses > 0 ? `Últimas ${stats.scoredResponses} evaluadas` : 'Sin evaluaciones aún', image: '/images/dashboard/metric-average.jpg' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              className="metric-card"
              initial={motionEnabled ? { opacity: 0, y: 16, rotateX: -4 } : false}
              animate={{
                opacity: 1,
                y: motionEnabled ? [0, -4, 0] : 0,
                rotateX: motionEnabled ? [0, 1.1, 0] : 0,
                rotateY: motionEnabled ? [0, index === 0 ? -1.1 : index === 2 ? 1.1 : 0, 0] : 0,
              }}
              whileHover={motionEnabled ? { y: -7, scale: 1.025, rotateX: 3.2, rotateY: index === 0 ? -3 : index === 2 ? 3 : 0 } : undefined}
              transition={{
                opacity: { duration: motionEnabled ? .38 : 0, delay: motionEnabled ? index * .09 : 0 },
                y: { duration: motionEnabled ? 4.8 + index * .45 : 0, delay: motionEnabled ? index * .2 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
                rotateX: { duration: motionEnabled ? 5.2 + index * .35 : 0, delay: motionEnabled ? index * .12 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
                rotateY: { duration: motionEnabled ? 6 + index * .3 : 0, delay: motionEnabled ? index * .16 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
              }}
              style={{ transformStyle: 'preserve-3d', transformPerspective: 1100 }}
            >
              <span className="metric-image" aria-hidden="true"><img src={item.image} alt="" loading="lazy" decoding="async" /></span>
              <div className="metric-top">
                <span>{item.label}</span>
                <item.icon className="metric-icon h-4 w-4" />
              </div>
              <p className="metric-value">{item.value}</p>
              <p className="metric-note">{item.note}</p>
            </motion.div>
          ))}
        </motion.section>
      )}

      <motion.section variants={fadeUp} className="dashboard-practice-panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">Elige tu formato</p>
            <h2 className="section-title">Practicar ahora</h2>
          </div>
          <span className="section-note hidden sm:block">Una buena respuesta empieza con un ensayo.</span>
        </div>
        <div className="practice-grid">
          <MotionLink
            to="/setup/voice"
            className="practice-card practice-card--voice"
            initial={motionEnabled ? { opacity: 0, y: 18, rotateX: -3 } : false}
            animate={{ opacity: 1, y: motionEnabled ? [0, -3, 0] : 0, rotateX: motionEnabled ? [0, .8, 0] : 0, rotateY: motionEnabled ? [0, -.7, 0] : 0 }}
            whileHover={motionEnabled ? { y: -7, rotateX: 3, rotateY: -2.4, scale: 1.012 } : undefined}
            whileTap={motionEnabled ? { scale: .985 } : undefined}
            transition={{
              opacity: { duration: motionEnabled ? .42 : 0, delay: motionEnabled ? .08 : 0 },
              y: { duration: motionEnabled ? 5.8 : 0, delay: motionEnabled ? .3 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
              rotateX: { duration: motionEnabled ? 6.2 : 0, delay: motionEnabled ? .3 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
              rotateY: { duration: motionEnabled ? 7 : 0, delay: motionEnabled ? .3 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
            }}
            style={{ transformStyle: 'preserve-3d', transformPerspective: 1100 }}
          >
            <span className="practice-card-image" aria-hidden="true"><img src="/images/dashboard/practice-voice.jpg" alt="" loading="lazy" decoding="async" /></span>
            <div className="practice-card-top">
              <span className="practice-number">Responde en voz alta</span>
              <span className="practice-icon"><Mic className="h-5 w-5" /></span>
            </div>
            <div>
              <h3>Habla en tiempo real</h3>
              <p>Practica con ritmo natural y recibe comentarios sobre el contenido de tus respuestas.</p>
            </div>
            <div className="practice-card-bottom">
              <span>Configurar práctica por voz</span>
              <ArrowRight className="practice-arrow h-4 w-4" />
            </div>
          </MotionLink>

          <MotionLink
            to="/setup/text"
            className="practice-card practice-card--text"
            initial={motionEnabled ? { opacity: 0, y: 18, rotateX: -3 } : false}
            animate={{ opacity: 1, y: motionEnabled ? [0, -3, 0] : 0, rotateX: motionEnabled ? [0, .8, 0] : 0, rotateY: motionEnabled ? [0, .7, 0] : 0 }}
            whileHover={motionEnabled ? { y: -7, rotateX: 3, rotateY: 2.4, scale: 1.012 } : undefined}
            whileTap={motionEnabled ? { scale: .985 } : undefined}
            transition={{
              opacity: { duration: motionEnabled ? .42 : 0, delay: motionEnabled ? .18 : 0 },
              y: { duration: motionEnabled ? 6.3 : 0, delay: motionEnabled ? .6 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
              rotateX: { duration: motionEnabled ? 6.8 : 0, delay: motionEnabled ? .6 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
              rotateY: { duration: motionEnabled ? 7.5 : 0, delay: motionEnabled ? .6 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
            }}
            style={{ transformStyle: 'preserve-3d', transformPerspective: 1100 }}
          >
            <span className="practice-card-image" aria-hidden="true"><img src="/images/dashboard/practice-text.jpg" alt="" loading="lazy" decoding="async" /></span>
            <div className="practice-card-top">
              <span className="practice-number">Ordena tus ideas</span>
              <span className="practice-icon"><FileText className="h-5 w-5" /></span>
            </div>
            <div>
              <h3>Piensa por escrito</h3>
              <p>Construye una respuesta clara y recibe retroalimentación detallada de la IA.</p>
            </div>
            <div className="practice-card-bottom">
              <span>Configurar práctica por texto</span>
              <ArrowRight className="practice-arrow h-4 w-4" />
            </div>
          </MotionLink>
        </div>
      </motion.section>

      {!isFirstTime && (
        <motion.section
          variants={fadeUp}
          className={`dashboard-lower ${progressData.length < 2 ? 'dashboard-lower--solo' : ''}`}
        >
          {progressData.length >= 2 && (
            <div className="dashboard-panel">
              <h2 className="panel-heading"><BarChart2 className="h-4 w-4" /> Progreso por sesión</h2>
              <div className="progress-chart">
                {progressData.map((session, i) => (
                  <motion.div
                    key={session.sessionNum}
                    className="progress-bar-item"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.32 }}
                  >
                    <span className="progress-bar-value">{session.avg}</span>
                    <div className="progress-track">
                      <motion.div
                        className="progress-fill"
                        initial={{ height: 0 }}
                        animate={{ height: Math.max(10, session.avg * 10) + '%' }}
                        transition={{ delay: i * 0.06, duration: 0.45 }}
                      />
                    </div>
                    <span className="progress-date">{session.date}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 border-t border-[var(--border)] pt-3">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--lime)]" />
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                  {progressData[progressData.length - 1].avg > progressData[0].avg
                    ? 'Vas subiendo tu nivel. Sigue practicando para consolidar el progreso.'
                    : progressData[progressData.length - 1].avg < progressData[0].avg
                      ? 'Cada práctica te da una oportunidad concreta para afinar tu respuesta.'
                      : 'Tu resultado se mantiene estable. Prueba otro tipo de pregunta.'}
                </p>
              </div>
            </div>
          )}

          <div className="dashboard-panel">
            <h2 className="panel-heading"><Brain className="h-4 w-4" /> Una recomendación para tu siguiente sesión</h2>
            <p className="tip-panel-intro">Ideas concretas basadas en tus respuestas más recientes.</p>
            {stats.recentTips.length > 0 ? (
              <div className="tip-list">
                {stats.recentTips.map((tip, i) => (
                  <motion.div
                    key={`${tip.date}-${tip.question}-${i}`}
                    className="dashboard-tip-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: motionEnabled ? [0, -2, 0] : 0, rotateX: motionEnabled ? [0, .5, 0] : 0 }}
                    transition={{
                      opacity: { delay: i * 0.08 + 0.1, duration: 0.35 },
                      y: { delay: i * .24, duration: 5.2 + i * .4, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
                      rotateX: { delay: i * .24, duration: 6 + i * .4, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' },
                    }}
                    style={{ transformStyle: 'preserve-3d', transformPerspective: 900 }}
                  >
                    <div className="dashboard-tip-topline">
                      <span className="dashboard-tip-icon"><Lightbulb className="h-4 w-4" /></span>
                      <span className="dashboard-tip-label">Práctica reciente</span>
                      <time>{tip.date}</time>
                    </div>
                    {tip.question && (
                      <p className="dashboard-tip-question">A partir de tu respuesta a: <span>{tip.question}</span></p>
                    )}
                    <p className="dashboard-tip-text">{tip.text}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="empty-tip">Cuando completes una entrevista, aquí aparecerán las recomendaciones generadas a partir de tus respuestas.</p>
            )}
          </div>
        </motion.section>
      )}
      </div>
    </motion.div>
  );
}
