import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Star, TrendingUp, TrendingDown, Award, Brain,
  ArrowRight, RotateCcw, Home, Loader2, CheckCircle2,
  AlertCircle, Lightbulb, Trophy
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { generateAIText } from '@/lib/ai-feedback';
import ResponseReview from '@/components/ResponseReview';
import FlowError from '@/components/FlowError';
import LoadingState from '@/components/LoadingState';
import type { SessionResponse } from '@/types';

interface SessionSummary {
  totalQuestions: number;
  avgScore: number;
  bestResponse: SessionResponse | null;
  worstResponse: SessionResponse | null;
  responses: SessionResponse[];
  mode: string;
  roleFocus: string;
}

const ROLE_LABELS: Record<string, string> = {
  general: 'General ISC',
  web: 'Desarrollo Web',
  backend: 'Backend',
  bd: 'Bases de Datos',
};

export default function SessionResultsScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [overallTip, setOverallTip] = useState('');
  const [loadingTip, setLoadingTip] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadResults() {
      setLoading(true);
      setLoadError(null);
      if (!user || !sessionId || sessionId === 'null') {
        setLoadError('No encontramos el identificador de la entrevista. Puedes volver a iniciar una sesión desde el panel.');
        setLoading(false);
        return;
      }

      try {
        const { data: session, error: sessionError } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .single();

        if (!active) return;
        if (sessionError || !session) {
          setLoadError('No encontramos esta sesión o no está disponible para tu cuenta.');
          setLoading(false);
          return;
        }

        if (session.status === 'in_progress') {
          const params = new URLSearchParams({
            sessionId: session.id,
            role: session.role_focus,
            type: session.session_type,
            count: String(session.question_count),
          });
          navigate(`/${session.mode}?${params.toString()}`, { replace: true });
          return;
        }
        if (session.status === 'abandoned') {
          setLoadError('Esta sesión fue descartada. Puedes revisar las respuestas guardadas en tu perfil.');
          setLoading(false);
          return;
        }

        const { data: responses, error: responsesError } = await supabase
          .from('session_responses')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (!active) return;
        if (responsesError) {
          setLoadError('No pudimos cargar las respuestas de esta entrevista. Inténtalo otra vez.');
          setLoading(false);
          return;
        }

        const all = (responses as SessionResponse[]) ?? [];
        const scored = all.filter(r => r.ai_score > 0);
        const avg = scored.length > 0
          ? Math.round((scored.reduce((sum, response) => sum + response.ai_score, 0) / scored.length) * 10) / 10
          : 0;

        const best = [...scored].sort((a, b) => b.ai_score - a.ai_score)[0] ?? null;
        const worst = [...scored].sort((a, b) => a.ai_score - b.ai_score)[0] ?? null;

        setSummary({
          totalQuestions: all.length,
          avgScore: avg,
          bestResponse: best,
          worstResponse: worst,
          responses: all,
          mode: session.mode,
          roleFocus: session.role_focus,
        });
        setLoading(false);

        if (active) await generateOverallTip(all, session.role_focus);
      } catch {
        if (!active) return;
        setLoadError('Ocurrió un problema al cargar los resultados. Revisa tu conexión e inténtalo de nuevo.');
        setLoading(false);
      }
    }
    loadResults();
    return () => { active = false; };
  }, [sessionId, user, retryCount, navigate]);

  async function generateOverallTip(responses: SessionResponse[], role: string) {
    const scoredResponses = responses.filter(response => response.ai_score > 0);
    if (scoredResponses.length === 0) {
      setOverallTip('Continúa practicando para seguir mejorando.');
      setLoadingTip(false);
      return;
    }

    const resumen = scoredResponses
      .slice(0, 8)
      .map((r, i) => `Pregunta ${i + 1} (${r.ai_score}/10): ${r.question_text.slice(0, 80)}`)
      .join('\n');

    const prompt = `Eres un coach de entrevistas laborales. Un candidato acaba de terminar una sesión de práctica para el área de ${ROLE_LABELS[role] ?? role}.

Resultados de la sesión:
${resumen}

En máximo 80 palabras en español, da UN consejo general práctico y específico para que mejore en su próxima sesión. Enfócate en el patrón más común de debilidad que ves en los puntajes. Responde SOLO el consejo, sin saludos ni introducción.`;

    try {
      const tip = await generateAIText(prompt, 'text');
      setOverallTip(tip || 'Continúa practicando para seguir mejorando.');
    } catch {
      setOverallTip('Continúa practicando para seguir mejorando.');
    } finally {
      setLoadingTip(false);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 8) return 'text-teal-600';
    if (score >= 5) return 'text-amber-600';
    return 'text-red-500';
  }

  function getScoreBg(score: number) {
    if (score >= 8) return 'bg-teal-50 border-teal-100';
    if (score >= 5) return 'bg-amber-50 border-amber-100';
    return 'bg-red-50 border-red-100';
  }

  function getPerformanceLabel(avg: number) {
    if (avg === 0) return { label: 'Sin evaluación de IA', icon: Brain, color: 'text-slate-500' };
    if (avg >= 8) return { label: 'Excelente', icon: Trophy, color: 'text-teal-600' };
    if (avg >= 6) return { label: 'Bueno', icon: Award, color: 'text-blue-600' };
    if (avg >= 4) return { label: 'Regular', icon: TrendingUp, color: 'text-amber-600' };
    return { label: 'Necesita práctica', icon: TrendingDown, color: 'text-red-500' };
  }

  if (loading) {
    return <LoadingState label="Calculando resultados..." />;
  }

  if (!summary && loadError) {
    return (
      <FlowError icon={AlertCircle} eyebrow="Resultados de entrevista" title="No pudimos abrir tus resultados" description={loadError}>
        <button type="button" onClick={() => setRetryCount(attempt => attempt + 1)} className="flow-primary">Reintentar</button>
        <button type="button" onClick={() => navigate('/dashboard')} className="flow-secondary">Volver al panel</button>
      </FlowError>
    );
  }
  if (!summary) return null;

  const hasScoredResponses = summary.responses.some(response => response.ai_score > 0);
  const perf = getPerformanceLabel(summary.avgScore);

  return (
    <div className="interview-experience interview-experience--results results-shell mx-auto animate-fade-in space-y-5">

      {/* Header de resultados */}
      <div className="results-hero rounded-3xl p-7 text-center relative overflow-hidden">
        <img className="results-hero-image" src="/images/interview-flow/results-analytics.jpg" alt="" />
        <span className="results-hero-overlay" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative">
          <p className="results-eyebrow text-teal-100 text-sm mb-2">SESIÓN COMPLETADA · {ROLE_LABELS[summary.roleFocus] ?? summary.roleFocus}</p>
          <h1 className="text-3xl font-bold mb-1">Resultados</h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <perf.icon className="w-6 h-6 text-white" />
            <span className="text-xl font-semibold">{perf.label}</span>
          </div>
        </div>
      </div>

      {/* Puntuación general */}
      <div className="results-score-card bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <p className="text-sm text-slate-500 mb-1">Puntuación promedio de la sesión</p>
        <div className="flex items-end justify-center gap-1 mb-3">
          <span className={`text-6xl font-bold ${hasScoredResponses ? getScoreColor(summary.avgScore) : 'text-slate-400'}`}>
            {hasScoredResponses ? summary.avgScore : '—'}
          </span>
          <span className="text-slate-300 text-2xl mb-2">/10</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="results-score-fill h-full rounded-full transition-all duration-1000"
            style={{ width: `${hasScoredResponses ? summary.avgScore * 10 : 0}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">{summary.totalQuestions} preguntas respondidas</p>
      </div>

      {/* Mejor y peor respuesta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {summary.bestResponse && (
          <div className={`results-highlight-card results-highlight-card--best rounded-2xl border p-4 ${getScoreBg(summary.bestResponse.ai_score)}`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Mejor respuesta</p>
              <span className={`ml-auto font-bold ${getScoreColor(summary.bestResponse.ai_score)}`}>
                {summary.bestResponse.ai_score}/10
              </span>
            </div>
            <p className="text-sm text-slate-700 line-clamp-2 leading-snug">
              {summary.bestResponse.question_text}
            </p>
          </div>
        )}
        {summary.worstResponse && summary.worstResponse.id !== summary.bestResponse?.id && (
          <div className={`results-highlight-card results-highlight-card--improve rounded-2xl border p-4 ${getScoreBg(summary.worstResponse.ai_score)}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">A mejorar</p>
              <span className={`ml-auto font-bold ${getScoreColor(summary.worstResponse.ai_score)}`}>
                {summary.worstResponse.ai_score}/10
              </span>
            </div>
            <p className="text-sm text-slate-700 line-clamp-2 leading-snug">
              {summary.worstResponse.question_text}
            </p>
          </div>
        )}
      </div>

      {/* Siguiente paso de práctica */}
      <div className="results-tip-panel results-highlight-card rounded-2xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-amber-600" />
          <p className="font-bold text-slate-800">Siguiente paso de práctica</p>
        </div>
        {loadingTip ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            <p className="text-sm text-slate-500">Generando consejo personalizado...</p>
          </div>
        ) : (
          <p className="text-sm text-slate-700 leading-relaxed">{overallTip}</p>
        )}
      </div>

      {/* Detalle por pregunta */}
      <div className="results-detail-panel bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-slate-400" />
          <p className="font-bold text-slate-800">Detalle por pregunta</p>
        </div>
        <div className="space-y-3">
          {summary.responses.map((response, index) => (
            <ResponseReview key={response.id} response={response} index={index + 1} />
          ))}
        </div>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4">
        <button
          onClick={() => navigate(`/setup/${summary.mode}`)}
          className="results-primary flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Nueva sesión
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="results-secondary flex items-center justify-center gap-2 bg-white text-slate-700 font-semibold py-3 rounded-xl border border-slate-200 hover:border-teal-200 transition-all"
        >
          <Home className="w-4 h-4" />
          Inicio
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="results-secondary flex items-center justify-center gap-2 bg-white text-slate-700 font-semibold py-3 rounded-xl border border-slate-200 hover:border-teal-200 transition-all"
        >
          <Star className="w-4 h-4" />
          Mi historial
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

    </div>
  );
}
