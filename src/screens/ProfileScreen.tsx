import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  User, Mail, Briefcase, Lightbulb, Star, Award, Loader2, Save,
  MessageSquare, Trash2, Clock3, ArrowUpRight,
  CheckCircle2, ShieldCheck, TrendingUp, GraduationCap, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import ProfileIllustration from '@/components/ProfileIllustration';
import ResponseReview from '@/components/ResponseReview';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { SessionResponse, ExperienceLevel } from '@/types';

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { confirm, dialog } = useConfirmDialog();
  const motionEnabled = !useReducedMotion();
  const [fullName, setFullName] = useState('');
  const [careerField, setCareerField] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('junior');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<SessionResponse[]>([]);
  const [hasPracticeHistory, setHasPracticeHistory] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [historyDeletedMsg, setHistoryDeletedMsg] = useState(false);
  const [stats, setStats] = useState({ total: 0, avgScore: 0, bestScore: 0 });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setCareerField(profile.career_field || '');
      setExperienceLevel(profile.experience_level || 'junior');
    }
  }, [profile]);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      setLoadingResponses(true);
      setHistoryError(null);
      if (!user) {
        if (active) setLoadingResponses(false);
        return;
      }
      try {
        const [countResult, historyResult, sessionsCountResult] = await Promise.all([
          supabase.from('session_responses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('session_responses').select('*').eq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(50),
          supabase.from('interview_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);
        if (countResult.error || historyResult.error || sessionsCountResult.error) throw new Error('No se pudo cargar el historial.');
        const recent = (historyResult.data as SessionResponse[]) ?? [];
        const scored = recent.filter((response) => response.ai_score > 0);
        if (!active) return;
        setResponses(recent);
        setHasPracticeHistory((sessionsCountResult.count ?? 0) > 0);
        setStats({
          total: countResult.count ?? 0,
          avgScore: scored.length > 0
            ? Math.round((scored.reduce((sum, response) => sum + response.ai_score, 0) / scored.length) * 10) / 10
            : 0,
          bestScore: scored.length > 0 ? Math.max(...scored.map((response) => response.ai_score)) : 0,
        });
      } catch {
        if (!active) return;
        setResponses([]);
        setHasPracticeHistory(false);
        setStats({ total: 0, avgScore: 0, bestScore: 0 });
        setHistoryError('No pudimos cargar tu historial. Revisa tu conexión e inténtalo otra vez.');
      } finally {
        if (active) setLoadingResponses(false);
      }
    }
    loadHistory();
    return () => { active = false; };
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);

    const { error: saveError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName.trim(),
        career_field: careerField.trim(),
        experience_level: experienceLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (saveError) {
      setError('No se pudo guardar. Intenta de nuevo.');
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  async function handleDeleteHistory() {
    if (!user || !hasPracticeHistory) return;
    const confirmed = await confirm({
      eyebrow: 'Eliminar historial',
      title: '¿Borrar todas tus prácticas?',
      description: 'Se eliminarán permanentemente tus sesiones y respuestas guardadas. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar historial',
      cancelLabel: 'Conservar historial',
      tone: 'danger',
    });
    if (!confirmed) return;

    setDeletingHistory(true);
    setHistoryError(null);
    try {
      const { error: deleteError } = await supabase.from('interview_sessions').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;
      setResponses([]);
      setHasPracticeHistory(false);
      setStats({ total: 0, avgScore: 0, bestScore: 0 });
      setHistoryDeletedMsg(true);
      window.setTimeout(() => setHistoryDeletedMsg(false), 3000);
    } catch {
      setHistoryError('No se pudo eliminar el historial. Inténtalo otra vez o revisa tu conexión.');
    } finally {
      setDeletingHistory(false);
    }
  }

  const experienceOptions: { value: ExperienceLevel; label: string; short: string; icon: typeof Lightbulb }[] = [
    { value: 'junior', label: 'Inicial', short: 'Fundamentos y razonamiento', icon: GraduationCap },
    { value: 'mid',    label: 'Intermedio', short: 'Autonomía y decisiones', icon: TrendingUp },
    { value: 'senior', label: 'Avanzado', short: 'Complejidad e impacto', icon: Award },
    { value: 'todos',  label: 'Flexible', short: 'Niveles combinados', icon: Zap },
  ];
  const experienceDescriptions: Record<ExperienceLevel, string> = {
    junior: 'Se aceptan proyectos académicos, personales, prácticas o laborales; se priorizan fundamentos y razonamiento.',
    mid: 'Se priorizan autonomía, decisiones justificadas, colaboración y resultados observables cuando existan.',
    senior: 'Se profundiza en decisiones complejas, confiabilidad e impacto; liderazgo cuando sea pertinente.',
    todos: 'Se combinan preguntas con expectativas equilibradas, sin asumir antigüedad laboral.',
  };
  const displayName = fullName.trim() || profile?.full_name || user?.email?.split('@')[0] || 'Tu perfil';
  const levelLabel = experienceOptions.find(option => option.value === experienceLevel)?.label ?? 'Inicial';
  return (
    <div className="profile-screen profile-shell mx-auto animate-fade-in space-y-6">
      {dialog}
      <motion.div
        className="profile-unified-frame"
        initial={{ opacity: 0, y: 18, rotateX: -1.5 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: .55, ease: [.22, 1, .36, 1] }}
        style={{ transformPerspective: 1300, transformStyle: 'preserve-3d' }}
      >
      <motion.section
        className="profile-hero"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .45, delay: .08, ease: [.22, 1, .36, 1] }}
      >
        <div className="profile-hero-copy">
          <span className="profile-hero-eyebrow"><img className="profile-hero-emblem" src="/images/profile/profile-emblem.svg" alt="" /> TU ESPACIO PERSONAL</span>
          <h1 aria-label="Tu práctica, en perspectiva.">
            <motion.span
              className="profile-hero-title-line"
              initial={motionEnabled ? { opacity: 0, y: 22, rotateX: -32, filter: 'blur(7px)' } : false}
              animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
              transition={{ duration: motionEnabled ? .72 : 0, delay: motionEnabled ? .14 : 0, ease: [.22, 1, .36, 1] }}
              style={{ transformPerspective: 850, transformStyle: 'preserve-3d', transformOrigin: '50% 100%' }}
            >Tu práctica,</motion.span>
            <motion.span
              className="profile-hero-title-line profile-hero-title-line--accent"
              initial={motionEnabled ? { opacity: 0, y: 28, rotateX: -38, filter: 'blur(9px)' } : false}
              animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
              transition={{ duration: motionEnabled ? .82 : 0, delay: motionEnabled ? .25 : 0, ease: [.22, 1, .36, 1] }}
              style={{ transformPerspective: 850, transformStyle: 'preserve-3d', transformOrigin: '50% 100%' }}
            >en perspectiva.</motion.span>
          </h1>
          <p>Hola, {displayName}. Define cómo quieres practicar y revisa qué patrones dejan tus respuestas sesión tras sesión.</p>
          <div className="profile-hero-tags">
            <span><User /> {levelLabel}</span>
            <span><MessageSquare /> {loadingResponses ? '…' : `${stats.total} respuestas`}</span>
          </div>
        </div>
        <ProfileIllustration
          name={displayName}
          level={levelLabel}
          sessions={stats.total}
          average={stats.avgScore}
          best={stats.bestScore}
        />
      </motion.section>

      <motion.section
        className="profile-metrics"
        aria-label="Resumen de práctica"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .45, delay: .14, ease: [.22, 1, .36, 1] }}
      >
        <MetricCard icon={MessageSquare} label="Respuestas guardadas" value={loadingResponses ? '—' : String(stats.total)} detail="En tu historial" />
        <MetricCard icon={Star} label="Promedio reciente" value={loadingResponses ? '—' : stats.avgScore > 0 ? `${stats.avgScore}/10` : '—'} detail="Hasta 50 respuestas" />
        <MetricCard icon={Award} label="Mejor resultado" value={loadingResponses ? '—' : stats.bestScore > 0 ? `${stats.bestScore}/10` : '—'} detail="Puntuación más alta" />
      </motion.section>

      <motion.div
        className="profile-content-grid"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .48, delay: .2, ease: [.22, 1, .36, 1] }}
      >
        <motion.section className="profile-editor-card" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .42, delay: .25 }}>
          <div className="profile-section-heading">
            <span className="profile-heading-icon"><User /></span>
            <div><span>IDENTIDAD Y PREFERENCIAS</span><h2>Tu perfil profesional</h2></div>
            {savedMsg && <span className="profile-saved-indicator"><CheckCircle2 /> Guardado</span>}
          </div>

          <div className="profile-field-grid">
            <ProfileField icon={User} label="Nombre completo">
              <input type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setSavedMsg(false); setError(null); }} placeholder="¿Cómo te llamas?" autoComplete="name" />
            </ProfileField>
            <ProfileField icon={Mail} label="Correo electrónico">
              <input type="email" value={user?.email ?? ''} disabled autoComplete="email" />
            </ProfileField>
            <ProfileField icon={Briefcase} label="Campo profesional" wide>
              <input type="text" value={careerField} onChange={(e) => { setCareerField(e.target.value); setSavedMsg(false); setError(null); }} placeholder="Ej. Ingeniería de software" />
            </ProfileField>
          </div>

          <div className="profile-level-section">
            <div className="profile-level-heading"><div><h3>Ajusta tu punto de partida</h3><p>La IA adaptará las preguntas a este nivel de referencia.</p></div><span>{levelLabel.toUpperCase()}</span></div>
            <div className="profile-level-grid" role="radiogroup" aria-label="Nivel de experiencia para las entrevistas">
              {experienceOptions.map((option) => {
                const selected = experienceLevel === option.value;
                return (
                  <label key={option.value} className={`profile-level-choice ${selected ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="experience-level"
                      value={option.value}
                      checked={selected}
                      onChange={() => { setExperienceLevel(option.value); setSavedMsg(false); setError(null); }}
                    />
                    <span className="profile-level-icon"><option.icon /></span>
                    <span className="profile-level-copy"><strong>{option.label}</strong><small>{option.short}</small></span>
                    <span className="profile-level-check"><CheckCircle2 /></span>
                  </label>
                );
              })}
            </div>
            <p className="profile-level-guidance"><Lightbulb /> {experienceDescriptions[experienceLevel]} El nivel no depende solo de tus años de experiencia.</p>
          </div>

          <div className="profile-editor-footer">
            <span><ShieldCheck /> Solo tú puedes editar estos datos.</span>
            <button type="button" onClick={handleSave} disabled={saving} className="profile-save-btn">
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
          {error && <p className="profile-form-error" role="alert">{error}</p>}
        </motion.section>

        <motion.aside
          className="profile-response-insights"
          initial={{ opacity: 0, x: 12, rotateY: -3 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: .48, delay: .28, ease: [.22, 1, .36, 1] }}
          style={{ transformPerspective: 1000, transformStyle: 'preserve-3d' }}
        >
          <div className="profile-response-insights-heading">
            <span><TrendingUp /> ANÁLISIS DE RESPUESTAS</span>
            <h2>Lo que revelan tus respuestas.</h2>
            <p>Sigue las evaluaciones recientes y detecta cómo cambia tu desempeño con la práctica.</p>
          </div>
          <ProfileResponseChart responses={responses} />
        </motion.aside>
      </motion.div>

      <motion.section
        className="profile-history-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .48, delay: .28, ease: [.22, 1, .36, 1] }}
      >
        <div className="profile-history-heading">
          <div className="profile-section-heading">
            <span className="profile-heading-icon"><Clock3 /></span>
            <div><span>TUS SESIONES</span><h2>Historial de respuestas</h2></div>
          </div>
          <div className="profile-history-actions">
            <span className="profile-history-count">{loadingResponses ? 'Cargando…' : `${stats.total} respuestas`}</span>
            {hasPracticeHistory && (
              <button type="button" onClick={handleDeleteHistory} disabled={deletingHistory || loadingResponses} className="profile-delete-button">
                <Trash2 /> {deletingHistory ? 'Eliminando…' : 'Eliminar historial'}
              </button>
            )}
          </div>
        </div>

        {historyDeletedMsg && <p className="profile-history-success" role="status">Tu historial se eliminó correctamente.</p>}
        {loadingResponses ? (
          <div className="profile-history-state"><Loader2 className="animate-spin" /><span>Buscando tus respuestas…</span></div>
        ) : historyError ? (
          <div className="profile-history-state is-error" role="alert">{historyError}</div>
        ) : responses.length === 0 ? (
          <div className="profile-empty-history">
            <div><MessageSquare /></div><h3>Aquí empieza tu progreso</h3>
            <p>Cuando termines una entrevista, encontrarás tus respuestas y la retroalimentación de la IA en este espacio.</p>
            <Link to="/setup/text">Hacer mi primera práctica <ArrowUpRight /></Link>
          </div>
        ) : (
          <div className="profile-response-list">
            {stats.total > responses.length && <p className="profile-history-note">Mostrando las {responses.length} respuestas más recientes de {stats.total}.</p>}
            {responses.map((response, index) => <ResponseReview key={response.id} response={response} index={stats.total - index} />)}
          </div>
        )}
      </motion.section>
      </motion.div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof MessageSquare; label: string; value: string; detail: string }) {
  const motionEnabled = !useReducedMotion();
  return (
    <motion.article
      className="profile-metric-card"
      initial={motionEnabled ? { opacity: 0, y: 12, rotateX: -3 } : false}
      animate={{ opacity: 1, y: motionEnabled ? [0, -3, 0] : 0, rotateX: motionEnabled ? [0, 1, 0] : 0 }}
      whileHover={motionEnabled ? { y: -7, rotateX: 4, rotateY: -3, scale: 1.02 } : undefined}
      transition={{ duration: motionEnabled ? .26 : 0, y: { duration: motionEnabled ? 4.4 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' }, rotateX: { duration: motionEnabled ? 5 : 0, repeat: motionEnabled ? Infinity : 0, ease: 'easeInOut' } }}
      style={{ transformPerspective: 900, transformStyle: 'preserve-3d' }}
    >
      <div className="profile-metric-top"><span className="profile-metric-icon"><Icon /></span><span className="profile-metric-detail">{detail}</span></div>
      <strong>{value}</strong>
      <span className="profile-metric-label">{label}</span>
      <span className="profile-metric-line"><i /></span>
    </motion.article>
  );
}

function ProfileResponseChart({ responses }: { responses: SessionResponse[] }) {
  const scored = responses.filter(response => response.ai_score > 0).slice(0, 8).reverse();
  const width = 320;
  const height = 112;
  const side = 23;
  const top = 12;
  const baseline = 91;
  const points = scored.map((response, index) => ({
    score: response.ai_score,
    date: new Date(response.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
    x: scored.length === 1 ? width / 2 : side + index * ((width - side * 2) / (scored.length - 1)),
    y: baseline - (Math.max(0, Math.min(10, response.ai_score)) / 10) * (baseline - top),
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
    : '';
  const trend = points.length > 1 ? points[points.length - 1].score - points[0].score : 0;
  const trendCopy = points.length < 2
    ? 'Completa más respuestas evaluadas para empezar a comparar tu evolución.'
    : trend > 0
      ? `Tu puntuación subió ${Number(trend.toFixed(1))} puntos entre estas ${points.length} respuestas.`
      : trend < 0
        ? `Tu puntuación bajó ${Number(Math.abs(trend).toFixed(1))} puntos entre estas ${points.length} respuestas.`
        : `Tu puntuación se mantuvo estable en estas ${points.length} respuestas.`;

  return (
    <div className="profile-response-chart">
      <div className="profile-response-chart-head">
        <span><TrendingUp /> EVOLUCIÓN DE TUS RESPUESTAS</span>
        <strong>{points.length ? `${points[points.length - 1].score}/10` : '—'}</strong>
      </div>
      {points.length ? (
        <>
          <svg
            className="profile-response-chart-plot"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Puntuaciones de las últimas ${points.length} respuestas evaluadas: ${points.map(point => point.score).join(', ')} de 10.`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="profile-score-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#cbd2dc" stopOpacity=".28" />
                <stop offset="100%" stopColor="#cbd2dc" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[top, (top + baseline) / 2, baseline].map((y, index) => (
              <g key={y}>
                <line x1={side} x2={width - side} y1={y} y2={y} />
                <text className="profile-response-chart-axis" x="0" y={y + 3}>{[10, 5, 0][index]}</text>
              </g>
            ))}
            {areaPath && <path className="profile-response-chart-area" d={areaPath} />}
            {points.length > 1 && <path className="profile-response-chart-line" d={linePath} />}
            {points.map((point, index) => (
              <g key={`${point.date}-${index}`}>
                <title>{`${point.date}: ${point.score}/10`}</title>
                <circle className="profile-response-chart-point-halo" cx={point.x} cy={point.y} r="6" />
                <circle className="profile-response-chart-point" cx={point.x} cy={point.y} r="3" />
              </g>
            ))}
          </svg>
          <div className="profile-response-chart-foot">
            <span>{points.length > 1 ? `Hace ${points[0].date}` : points[0].date}</span>
            <span>{points.length > 1 ? `${points.length} respuestas evaluadas` : 'Primera respuesta evaluada'}</span>
            <span>{points[points.length - 1].date}</span>
          </div>
        </>
      ) : (
        <div className="profile-response-chart-empty">
          <svg className="profile-empty-chart-art" viewBox="0 0 320 78" fill="none" aria-hidden="true">
            <path className="profile-empty-chart-grid" d="M4 14H316M4 39H316M4 64H316" />
            <path className="profile-empty-chart-path" d="M6 58C30 57 34 43 58 44S86 61 108 49 140 24 164 32 191 55 213 43 248 18 270 27 293 37 314 13" />
            <circle className="profile-empty-chart-point" cx="58" cy="44" r="3" />
            <circle className="profile-empty-chart-point" cx="164" cy="32" r="3" />
            <circle className="profile-empty-chart-point" cx="270" cy="27" r="3" />
            <circle className="profile-empty-chart-end" cx="314" cy="13" r="4" />
          </svg>
          <div className="profile-empty-chart-copy">
            <strong>Tu evolución empieza con una respuesta.</strong>
            <span>Al completar prácticas evaluadas aparecerá aquí tu tendencia.</span>
          </div>
        </div>
      )}
      <p className="profile-response-trend">{trendCopy}</p>
    </div>
  );
}

function ProfileField({ icon: Icon, label, wide = false, children }: {
  icon: typeof User;
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`profile-field ${wide ? 'profile-field--wide' : ''}`}>
      <span className="profile-field-label">{label}</span>
      <span className="profile-field-control"><Icon />{children}</span>
    </label>
  );
}
