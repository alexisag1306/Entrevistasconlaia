import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText, RefreshCw, Send, Loader2, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { generateAIFeedback } from '@/lib/ai-feedback';
import { parseInterviewConfig } from '@/lib/interview-config';
import { buildQuestionQueue } from '@/lib/interview-questions';
import {
  completeInterviewSession, createInterviewSession, loadInterviewQuestionPool,
  loadInterviewResponses, loadInterviewSession, updateInterviewSessionProgress,
} from '@/lib/interview-data';
import { saveSessionResponse } from '@/lib/session-responses';
import FlowError from '@/components/FlowError';
import InterviewFeedback from '@/components/InterviewFeedback';
import LoadingState from '@/components/LoadingState';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { ExperienceLevel, InterviewQuestion, AIFeedback } from '@/types';

type Phase = 'answering' | 'submitting' | 'feedback';

// ── Componente ────────────────────────────────────────────────

export default function TextInterviewScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirm, dialog } = useConfirmDialog();

  // Leer config de la URL
  const interviewConfig = useMemo(() => parseInterviewConfig(searchParams), [searchParams]);
  const role       = interviewConfig?.role ?? 'general';
  const sessionType = interviewConfig?.sessionType ?? 'mixta';
  const count      = interviewConfig?.count ?? 10;
  const resumeSessionId = searchParams.get('sessionId');

  const [queue, setQueue]       = useState<InterviewQuestion[]>([]);
  const [qIndex, setQIndex]     = useState(0);
  const [answer, setAnswer]     = useState('');
  const [phase, setPhase]       = useState<Phase>('answering');
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [loading, setLoading]   = useState(true);
  const [sessionHistory, setSessionHistory] = useState<{ question: string; score: number }[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('junior');
  const [responseSaved, setResponseSaved] = useState(true);
  const [savingResponse, setSavingResponse] = useState(false);
  const [lastResponseDuration, setLastResponseDuration] = useState(0);

  const question = queue[qIndex] ?? null;
  const progress = queue.length > 0 ? ((qIndex + 1) / queue.length) * 100 : 0;
  const isLast   = qIndex >= queue.length - 1;

  // Cargar preguntas y crear la sesión solo cuando la configuración sea válida.
  useEffect(() => {
    let active = true;
    async function init() {
      setLoading(true);
      setSetupError(null);
      setSessionId(null);
      if (!interviewConfig) {
        setSetupError('La configuración de esta entrevista no es válida. Vuelve a elegir el área, el tipo y la duración.');
        setLoading(false);
        return;
      }
      if (!user) {
        setSetupError('Tu sesión de usuario ya no está disponible. Vuelve a iniciar sesión e inténtalo otra vez.');
        setLoading(false);
        return;
      }

      try {
        const { questions, recentlyAnsweredIds, experienceLevel: profileLevel, error: questionError } = await loadInterviewQuestionPool(user.id);

        if (!active) return;
        if (questionError) {
          setSetupError('No pudimos cargar las preguntas. Revisa tu conexión e inténtalo de nuevo.');
          setLoading(false);
          return;
        }

        let candidateLevel = profileLevel;
        let nextQueue: InterviewQuestion[];
        let nextSessionId: string | null;
        let initialIndex = 0;
        let previousAnswers: { question: string; score: number }[] = [];

        if (resumeSessionId) {
          const savedSession = await loadInterviewSession(user.id, resumeSessionId);
          if (!active) return;
          if (!savedSession || savedSession.mode !== 'text' || savedSession.status !== 'in_progress') {
            setSetupError('Esta sesión no está disponible para continuar. Inicia una práctica nueva desde la configuración.');
            setLoading(false);
            return;
          }

          candidateLevel = savedSession.experience_level;
          const questionById = new Map(questions.map(item => [item.id, item]));
          nextQueue = savedSession.question_ids.map(id => questionById.get(id)).filter((item): item is InterviewQuestion => Boolean(item));
          if (!savedSession.question_ids.length || nextQueue.length !== savedSession.question_ids.length) {
            setSetupError('No encontramos todas las preguntas de esta sesión. Tus respuestas guardadas siguen en tu historial; inicia una nueva práctica para continuar.');
            setLoading(false);
            return;
          }

          const savedResponses = await loadInterviewResponses(user.id, savedSession.id);
          if (!active) return;
          if (!savedResponses) {
            setSetupError('No pudimos recuperar las respuestas guardadas de esta sesión. Revisa tu conexión e inténtalo otra vez.');
            setLoading(false);
            return;
          }
          const answeredIds = new Set(savedResponses.map(item => item.question_id).filter((id): id is string => Boolean(id)));
          initialIndex = nextQueue.findIndex((item, index) => index >= savedSession.current_question_index && !answeredIds.has(item.id));
          if (initialIndex < 0) initialIndex = nextQueue.length;
          previousAnswers = savedResponses.filter(item => item.ai_score > 0).map(item => ({ question: item.question_text, score: item.ai_score }));
          nextSessionId = savedSession.id;
        } else {
          nextQueue = buildQuestionQueue(questions, role, sessionType, count, recentlyAnsweredIds, candidateLevel);
          if (nextQueue.length === 0) {
            setSetupError('No hay preguntas disponibles para esta configuración. Vuelve a elegir el área o el tipo de entrevista.');
            setLoading(false);
            return;
          }
          nextSessionId = await createInterviewSession({
            userId: user.id,
            mode: 'text',
            role,
            sessionType,
            questionCount: count,
            questions: nextQueue,
            experienceLevel: candidateLevel,
          });
        }

        if (nextQueue.length === 0) {
          setSetupError('No hay preguntas disponibles para esta configuración. Vuelve a elegir el área o el tipo de entrevista.');
          setLoading(false);
          return;
        }
        if (!active) return;
        if (!nextSessionId) {
          setSetupError('No pudimos guardar el inicio de esta sesión. Inténtalo de nuevo.');
          setLoading(false);
          return;
        }

        setSessionId(nextSessionId);
        setQueue(nextQueue);
        setQIndex(initialIndex);
        setExperienceLevel(candidateLevel);
        setSessionHistory(previousAnswers);
        setResponseSaved(true);
        setAnswer('');
        setFeedback(null);
        setPhase('answering');
        setStartTime(Date.now());
        if (resumeSessionId && initialIndex >= nextQueue.length) {
          const completed = await completeInterviewSession(user.id, nextSessionId, nextQueue.length);
          if (!active) return;
          if (!completed) {
            setSetupError('No pudimos cerrar esta sesión. Reintenta para recuperar el progreso.');
            setLoading(false);
            return;
          }
          navigate(`/results/${nextSessionId}`, { replace: true });
          return;
        }
        setLoading(false);
      } catch {
        if (!active) return;
        setSetupError('Ocurrió un problema al preparar la entrevista. Revisa tu conexión e inténtalo de nuevo.');
        setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [user, role, sessionType, count, resumeSessionId, initAttempt, navigate, interviewConfig]);

  const submitAnswer = useCallback(async () => {
    if (!question || !user || !answer.trim()) return;
    if (!sessionId) {
      setSetupError('No encontramos el identificador de esta sesión. Vuelve a intentarlo desde la configuración.');
      return;
    }
    setPhase('submitting');
    setError(null);
    setResponseSaved(false);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    setLastResponseDuration(duration);
    const aiResult = await generateAIFeedback(
      question.question_text,
      answer,
      question.tips,
      question.phase,
      question.category,
      'text',
      role,
      experienceLevel,
      duration,
      sessionHistory,
    );

    // Agregar esta respuesta al historial de la sesión
    if (aiResult.source === 'ai' && aiResult.assessmentStatus === 'scored') {
      setSessionHistory(prev => [...prev, { question: question.question_text, score: aiResult.score }]);
    }

    const saved = await saveSessionResponse({
      sessionId,
      userId: user.id,
      question,
      responseText: answer,
      responseMode: 'text',
      feedback: aiResult,
      durationSeconds: duration,
    });
    setResponseSaved(saved);
    if (!saved) setError('No se pudo guardar esta respuesta en tu historial. Puedes continuar, pero no aparecerá en los resultados guardados.');

    setFeedback(aiResult);
    setPhase('feedback');
  }, [question, user, sessionId, answer, startTime, role, experienceLevel, sessionHistory]);

  async function retrySaveResponse() {
    if (!question || !user || !sessionId || !feedback || responseSaved || savingResponse) return;
    setSavingResponse(true);
    const saved = await saveSessionResponse({
      sessionId,
      userId: user.id,
      question,
      responseText: answer,
      responseMode: 'text',
      feedback,
      durationSeconds: lastResponseDuration,
    });
    setResponseSaved(saved);
    setSavingResponse(false);
    setError(saved ? null : 'El guardado sigue sin completarse. Revisa tu conexión y vuelve a intentarlo.');
  }

  async function nextQuestion() {
    if (!user || !sessionId) {
      setSetupError('No encontramos el identificador de esta sesión. Vuelve a intentarlo desde la configuración.');
      return;
    }
    if (phase === 'answering' && answer.trim()) {
      const discardDraft = await confirm({
        eyebrow: 'Pregunta actual',
        title: '¿Descartar esta respuesta?',
        description: 'El texto que escribiste todavía no está guardado. Si avanzas, se perderá y pasarás a la siguiente pregunta.',
        confirmLabel: 'Descartar y avanzar',
        cancelLabel: 'Seguir respondiendo',
        tone: 'warning',
      });
      if (!discardDraft) return;
    }
    if (phase === 'feedback' && !responseSaved) {
      setError('Guarda esta respuesta antes de avanzar para que puedas retomarla después.');
      return;
    }
    const nextIndex = qIndex + 1;
    if (isLast) {
      const completed = await completeInterviewSession(user.id, sessionId, nextIndex);
      if (!completed) {
        setError('No pudimos guardar el cierre de la sesión. Intenta finalizar otra vez.');
        return;
      }
      navigate(`/results/${sessionId}`);
      return;
    }
    const savedProgress = await updateInterviewSessionProgress(user.id, sessionId, nextIndex);
    if (!savedProgress) {
      setError('No pudimos guardar el progreso. Revisa tu conexión antes de continuar.');
      return;
    }
    setQIndex(nextIndex);
    setAnswer('');
    setFeedback(null);
    setPhase('answering');
    setStartTime(Date.now());
    setResponseSaved(true);
    setLastResponseDuration(0);
  }

  async function handleExit() {
    if (sessionId) {
      const hasDraft = phase === 'answering' && Boolean(answer.trim());
      const leaveInterview = await confirm({
        eyebrow: 'Entrevista en curso',
        title: '¿Quieres salir de la entrevista?',
        description: hasDraft
          ? 'La sesión quedará pausada y podrás retomarla desde Inicio. Las respuestas guardadas se conservarán, pero el borrador actual se perderá.'
          : 'La sesión quedará pausada. Las respuestas guardadas se conservarán y podrás retomarla desde Inicio.',
        confirmLabel: 'Salir y pausar',
        cancelLabel: 'Seguir en entrevista',
      });
      if (!leaveInterview) return;
    }
    navigate('/dashboard');
  }

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  // ── Loading ──
  if (loading) {
    return <LoadingState label="Preparando la entrevista por texto..." />;
  }

  if (setupError) {
    return (
      <FlowError icon={FileText} eyebrow="Simulación por texto" title="No pudimos iniciar la entrevista" description={setupError}>
        <button type="button" onClick={() => setInitAttempt(attempt => attempt + 1)} className="flow-primary">Reintentar</button>
        <button type="button" onClick={() => navigate('/setup/text')} className="flow-secondary">Volver a configurar</button>
      </FlowError>
    );
  }

  return (
    <div className="interview-experience interview-experience--text text-interview-shell mx-auto animate-fade-in">
      {dialog}

      <header className="interview-screen-header mb-6">
        <div className="interview-header-topline">
          <button
            onClick={handleExit}
            className="interview-exit-link flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Salir
          </button>
          <span className="interview-live-state"><i /> Sesión activa</span>
        </div>
        <div className="interview-header-hero">
          <div className="interview-header-copy">
            <p className="interview-eyebrow">SIMULACIÓN · PRÁCTICA POR TEXTO</p>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Entrevista por Texto
            </h1>
            <p className="interview-header-subtitle">Estructura tu respuesta y comunica tu razonamiento paso a paso.</p>
          </div>
          <div className="interview-header-visual interview-header-visual--text" aria-hidden="true">
            <img src="/images/interview-flow/interview-team.jpg" alt="" />
            <span className="interview-visual-shade" />
            <span className="interview-visual-orbit interview-visual-orbit--one" />
            <span className="interview-visual-orbit interview-visual-orbit--two" />
            <span className="interview-visual-caption"><FileText className="h-3.5 w-3.5" /> RESPUESTA ENFOCADA</span>
            <span className="interview-visual-writing"><i /><i /><i /><i /></span>
          </div>
        </div>

        <div className="interview-progress-meta"><span>Pregunta {qIndex + 1} de {queue.length}</span><span>{Math.round(progress)}% completado</span></div>
        <div className="interview-progress-track mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-label="Progreso de la entrevista" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Tarjeta de pregunta */}
      {question && (
        <div key={question.id} className="interview-question-card bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 capitalize">
              {question.category}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              question.difficulty === 'fácil' ? 'bg-green-50 text-green-700' :
              question.difficulty === 'media' ? 'bg-amber-50 text-amber-700' :
              'bg-red-50 text-red-700'
            }`}>
              {question.difficulty}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 capitalize">
              Fase {question.phase}
            </span>
          </div>
          <p className="text-lg text-slate-800 font-medium leading-relaxed">
            {question.question_text}
          </p>
        </div>
      )}

      {/* Área de respuesta */}
      {phase === 'answering' && (
        <div className="space-y-4">
          <div className="interview-action-card interview-action-card--answer bg-white rounded-2xl border border-slate-200 p-6">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={8}
              autoFocus
              className="interview-answer-input w-full text-sm text-slate-700 resize-none focus:outline-none placeholder:text-slate-400"
              placeholder="Escribe tu respuesta aquí. Sé específico, usa el método STAR para preguntas conductuales y cuantifica resultados cuando sea posible..."
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">{wordCount} palabras</span>
              <button
                onClick={submitAnswer}
                disabled={!answer.trim()}
                className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Enviar respuesta
              </button>
            </div>
          </div>

          <button
            onClick={nextQuestion}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-teal-600 font-medium py-2.5 rounded-xl border border-slate-200 hover:border-teal-200 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Saltar esta pregunta
          </button>
        </div>
      )}

      {phase === 'submitting' && (
        <div className="interview-action-card interview-action-card--processing bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Loader2 className="w-10 h-10 text-teal-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Analizando tu respuesta...</p>
        </div>
      )}

      {phase === 'feedback' && feedback && (
        <InterviewFeedback
          feedback={feedback}
          response={answer}
          responseMode="text"
          responseSaved={responseSaved}
          savingResponse={savingResponse}
          isLast={isLast}
          onRetrySave={retrySaveResponse}
          onRetryAI={feedback.source === 'local' ? submitAnswer : undefined}
          onImproveAnswer={feedback.assessmentStatus === 'insufficient'
            ? () => { setFeedback(null); setError(null); setResponseSaved(true); setStartTime(Date.now()); setPhase('answering'); }
            : undefined}
          onNext={nextQuestion}
        />
      )}
    </div>
  );
}
