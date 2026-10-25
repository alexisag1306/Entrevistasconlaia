import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Loader2, ArrowRight, RefreshCw,
  CheckCircle2, Lightbulb, Star, Volume2, ChevronLeft, Sparkles
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
import LoadingState from '@/components/LoadingState';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { ExperienceLevel, InterviewQuestion, AIFeedback } from '@/types';

type Phase = 'idle' | 'recording' | 'processing' | 'feedback';

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionErrorLike = { error: string };
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

// ── Componente ────────────────────────────────────────────────
export default function VoiceInterviewScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirm, dialog } = useConfirmDialog();

  const interviewConfig = useMemo(() => parseInterviewConfig(searchParams), [searchParams]);
  const role        = interviewConfig?.role ?? 'general';
  const sessionType = interviewConfig?.sessionType ?? 'mixta';
  const count       = interviewConfig?.count ?? 10;
  const resumeSessionId = searchParams.get('sessionId');

  const [queue, setQueue]         = useState<InterviewQuestion[]>([]);
  const [qIndex, setQIndex]       = useState(0);
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase]         = useState<Phase>('idle');
  const [feedback, setFeedback]   = useState<AIFeedback | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [sessionHistory, setSessionHistory] = useState<{ question: string; score: number }[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('junior');
  const [responseSaved, setResponseSaved] = useState(true);
  const [savingResponse, setSavingResponse] = useState(false);
  const [lastResponseDuration, setLastResponseDuration] = useState(0);

  const recognitionRef  = useRef<BrowserSpeechRecognition | null>(null);
  const recognitionRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRecognitionRef = useRef(false);
  const recognitionErrorRef = useRef<string | null>(null);
  const transcriptRef = useRef('');
  const submittingResponseRef = useRef(false);
  const startTimeRef    = useRef<number>(0);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechWindow = typeof window !== 'undefined' ? window as SpeechRecognitionWindow : null;
  const speechRecognitionAvailable = Boolean(
    speechWindow && (speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition)
      && speechWindow.isSecureContext,
  );

  async function handleExit() {
    if (sessionId) {
      const answerMayBeLost = phase === 'recording'
        || phase === 'processing'
        || (phase === 'idle' && Boolean(transcript.trim()))
        || (phase === 'feedback' && !responseSaved);
      const leaveInterview = await confirm({
        eyebrow: 'Entrevista en curso',
        title: '¿Quieres salir de la entrevista?',
        description: answerMayBeLost
          ? 'La sesión quedará pausada y podrás retomarla desde Inicio. Las respuestas guardadas se conservarán, pero la respuesta actual podría perderse porque aún no está guardada.'
          : 'La sesión quedará pausada. Las respuestas guardadas se conservarán y podrás retomarla desde Inicio.',
        confirmLabel: 'Salir y pausar',
        cancelLabel: 'Seguir en entrevista',
      });
      if (!leaveInterview) return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* Puede haberse detenido ya. */ }
      recognitionRef.current = null;
    }
    navigate('/dashboard');
  }

  const question = queue[qIndex] ?? null;
  const progress = queue.length > 0 ? ((qIndex + 1) / queue.length) * 100 : 0;
  const isLast   = qIndex >= queue.length - 1;

  // Cargar preguntas y crear la sesión solo cuando ya existe una cola válida.
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
      if (!resumeSessionId && !speechRecognitionAvailable) {
        setSetupError('El reconocimiento de voz no está disponible en este navegador. Usa la práctica por texto para continuar.');
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
          if (!savedSession || savedSession.mode !== 'voice' || savedSession.status !== 'in_progress') {
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
            mode: 'voice',
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
        setPhase('idle');
        setTranscript('');
        startTimeRef.current = Date.now();
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
  }, [user, role, sessionType, count, resumeSessionId, initAttempt, navigate, speechRecognitionAvailable, interviewConfig]);

  // Timer de grabación
  useEffect(() => {
    if (phase === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Detener el reconocimiento aunque se salga usando el menú global de navegación.
  useEffect(() => () => {
    stopRecognitionRef.current = true;
    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* El navegador puede haberlo detenido ya. */ }
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const finishRecording = useCallback(() => {
    const finalAnswer = transcriptRef.current.trim();
    setTranscript(finalAnswer);
    if (finalAnswer) {
      setError(null);
      setPhase(current => current === 'recording' ? 'processing' : current);
    } else {
      setPhase(current => current === 'recording' ? 'idle' : current);
      if (!recognitionErrorRef.current) setError('No se detectó voz. Revisa el micrófono e inténtalo de nuevo.');
    }
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    setTranscript('');
    transcriptRef.current = '';
    stopRecognitionRef.current = false;
    recognitionErrorRef.current = null;
    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }

    const recognitionWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition = recognitionWindow.SpeechRecognition || recognitionWindow.webkitSpeechRecognition;

    if (!SpeechRecognition || !window.isSecureContext) {
      setError('Este navegador no ofrece reconocimiento de voz compatible. Puedes continuar la práctica por texto.');
      return;
    }

    startTimeRef.current = Date.now();
    setPhase('recording');

    let finalTranscript = '';
    const startRecognition = () => {
      if (stopRecognitionRef.current) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-MX';

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const recognizedText = result[0]?.transcript ?? '';
          if (result.isFinal) finalTranscript += `${recognizedText} `;
          else interim += recognizedText;
        }
        const nextTranscript = `${finalTranscript}${interim}`;
        transcriptRef.current = nextTranscript;
        setTranscript(nextTranscript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorLike) => {
        if (event.error === 'no-speech') return;
        if (event.error === 'aborted' && stopRecognitionRef.current) return;

        const messages: Record<string, string> = {
          'not-allowed': 'El navegador bloqueó el micrófono. Permite el acceso para localhost desde el candado de la barra de direcciones.',
          'service-not-allowed': 'El navegador no permitió usar el servicio de reconocimiento de voz.',
          'audio-capture': 'No se pudo iniciar el micrófono. Comprueba que esté conectado y que ninguna otra aplicación lo esté ocupando.',
          network: 'El reconocimiento de voz perdió la conexión. Revisa internet y vuelve a iniciar la grabación.',
          'language-not-supported': 'El navegador no ofrece reconocimiento en español para esta sesión.',
        };
        const message = messages[event.error] ?? `El reconocimiento de voz se interrumpió (${event.error}). Vuelve a intentarlo.`;
        recognitionErrorRef.current = message;
        setError(message);
        stopRecognitionRef.current = true;
      };

      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;

        if (stopRecognitionRef.current) {
          finishRecording();
          return;
        }

        // Algunos navegadores cierran SpeechRecognition después de una pausa aunque
        // continuous esté activo. Reiniciamos el motor sin perder el texto ya oído.
        recognitionRestartTimerRef.current = setTimeout(() => {
          recognitionRestartTimerRef.current = null;
          startRecognition();
        }, 300);
      };

      recognitionRef.current = recognition;
      try {
        // El propio navegador solicita permiso al micrófono al iniciar. No abrimos y
        // cerramos antes otro MediaStream, porque puede cortar el reconocimiento.
        recognition.start();
      } catch (startError) {
        recognitionRef.current = null;
        stopRecognitionRef.current = true;
        const message = startError instanceof Error && startError.name === 'NotAllowedError'
          ? 'El navegador bloqueó el micrófono. Permite el acceso para localhost desde el candado de la barra de direcciones.'
          : 'No se pudo iniciar el reconocimiento de voz. Inténtalo de nuevo.';
        recognitionErrorRef.current = message;
        setError(message);
        setPhase('idle');
      }
    };

    startRecognition();
  }, [finishRecording]);

  const stopRecording = useCallback(() => {
    if (stopRecognitionRef.current) return;
    stopRecognitionRef.current = true;
    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      try { recognition.stop(); } catch { finishRecording(); }
    } else {
      finishRecording();
    }
  }, [finishRecording]);

  async function submitResponse() {
    if (submittingResponseRef.current || !question || !user) return;
    if (!sessionId) {
      setSetupError('No encontramos el identificador de esta sesión. Vuelve a intentarlo desde la configuración.');
      setPhase('idle');
      return;
    }
    submittingResponseRef.current = true;
    try {
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setLastResponseDuration(duration);
      setResponseSaved(false);
      const aiResult = await generateAIFeedback(
        question.question_text,
        transcript,
        question.tips,
        question.phase,
        question.category,
        'voice',
        role,
        experienceLevel,
        duration,
        sessionHistory,
      );

      if (aiResult.source === 'ai' && aiResult.assessmentStatus === 'scored') {
        setSessionHistory(prev => [...prev, { question: question.question_text, score: aiResult.score }]);
      }

      const saved = await saveSessionResponse({
        sessionId,
        userId: user.id,
        question,
        responseText: transcript,
        responseMode: 'voice',
        feedback: aiResult,
        durationSeconds: duration,
      });
      setResponseSaved(saved);
      if (!saved) setError('No se pudo guardar esta respuesta en tu historial. Puedes continuar, pero no aparecerá en los resultados guardados.');

      setFeedback(aiResult);
      setPhase('feedback');
    } catch (submitError) {
      console.error('[Entrevista por voz] No se pudo procesar la respuesta.', submitError);
      setError('No pudimos procesar esta respuesta. Puedes volver a intentarlo.');
      setPhase('idle');
    } finally {
      submittingResponseRef.current = false;
    }
  }

  useEffect(() => {
    if (phase === 'processing' && transcript.trim()) {
      submitResponse();
    } else if (phase === 'processing' && !transcript.trim()) {
      setPhase('idle');
      setError('No se detectó voz. Inténtalo de nuevo.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, transcript]);

  async function retrySaveResponse() {
    if (!question || !user || !sessionId || !feedback || responseSaved || savingResponse) return;
    setSavingResponse(true);
    const saved = await saveSessionResponse({
      sessionId,
      userId: user.id,
      question,
      responseText: transcript,
      responseMode: 'voice',
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
    setTranscript('');
    setFeedback(null);
    setPhase('idle');
    setRecordingTime(0);
    setResponseSaved(true);
    startTimeRef.current = Date.now();
    setLastResponseDuration(0);
  }

  const formatTime = (s: number) => {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Loading ──
  if (loading) {
    return <LoadingState label="Preparando la entrevista por voz..." />;
  }

  if (setupError) {
    return (
      <FlowError icon={Mic} eyebrow="Simulación por voz" title="No pudimos iniciar la entrevista" description={setupError}>
        <button type="button" onClick={() => setInitAttempt(attempt => attempt + 1)} className="flow-primary">Reintentar</button>
        {!speechRecognitionAvailable && <Link to="/setup/text" className="flow-secondary">Practicar por texto</Link>}
        <button type="button" onClick={() => navigate('/setup/voice')} className="flow-secondary">Volver a configurar</button>
      </FlowError>
    );
  }

  return (
    <div className="interview-experience interview-experience--voice voice-interview-shell mx-auto animate-fade-in">
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
            <p className="interview-eyebrow">SIMULACIÓN · PRÁCTICA POR VOZ</p>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Mic className="w-6 h-6 text-teal-600" />
              Entrevista por Voz
            </h1>
            <p className="interview-header-subtitle">Escucha, organiza tus ideas y responde con claridad.</p>
          </div>
          <div className="interview-header-visual" aria-hidden="true">
            <img src="/images/interview-setup/voice-professional.jpg" alt="" />
            <span className="interview-visual-shade" />
            <span className="interview-visual-orbit interview-visual-orbit--one" />
            <span className="interview-visual-orbit interview-visual-orbit--two" />
            <span className="interview-visual-caption"><Mic className="h-3.5 w-3.5" /> ENTREVISTADOR ACTIVO</span>
            <span className="interview-visual-wave">{[12, 21, 15, 29, 18, 25, 11, 22, 14, 27, 16].map((height, index) => <i key={index} style={{ height }} />)}</span>
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
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
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
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500">
              Fase {question.phase}
            </span>
          </div>
          <p className="text-lg text-slate-800 font-medium leading-relaxed">
            {question.question_text}
          </p>
        </div>
      )}

      {/* Interfaz de grabación */}
      {phase === 'idle' && (
        <div className="space-y-4">
          {!speechRecognitionAvailable && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" role="status">
              <p className="text-sm text-amber-800">Este navegador no permite transcribir voz aquí. Puedes practicar por texto sin perder las respuestas ya guardadas.</p>
              <Link to="/setup/text" className="flow-secondary inline-flex items-center gap-2">Cambiar a texto <ArrowRight className="h-4 w-4" /></Link>
            </div>
          )}
          {/* Aviso de lugar silencioso */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-lg">🎙️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Para mejores resultados</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Asegúrate de estar en un lugar silencioso. El reconocimiento de voz es sensible al ruido de fondo — música, conversaciones o ventiladores pueden afectar la transcripción.
              </p>
            </div>
          </div>

          <div className="interview-action-card interview-action-card--voice bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="mb-6">
              <button
                onClick={startRecording}
                disabled={!speechRecognitionAvailable}
                aria-label={speechRecognitionAvailable ? 'Iniciar grabación de respuesta' : 'Reconocimiento de voz no disponible'}
                className="interview-record-button relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/30 transition-all hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Mic className="w-10 h-10 text-white" />
              </button>
            </div>
            <p className="text-slate-600 font-medium">Toca para empezar a grabar tu respuesta</p>
            <p className="text-sm text-slate-400 mt-1">Habla claro y a un ritmo normal</p>

            <button
              onClick={nextQuestion}
              className="mt-6 flex items-center justify-center gap-2 text-slate-500 hover:text-teal-600 font-medium py-2.5 px-5 rounded-xl border border-slate-200 hover:border-teal-200 transition-all mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Saltar esta pregunta
            </button>
          </div>
        </div>
      )}

      {phase === 'recording' && (
        <div className="interview-action-card interview-action-card--recording bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="mb-6 relative flex items-center justify-center">
            {/* Ondas concéntricas animadas */}
            <span className="absolute w-24 h-24 rounded-full bg-red-100 animate-recording-ring" />
            <span className="absolute w-24 h-24 rounded-full bg-red-100 animate-recording-ring-2" />
            <span className="absolute w-24 h-24 rounded-full bg-red-100 animate-recording-ring-3" />
            <button
              onClick={stopRecording}
              className="relative w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 hover:scale-105 transition-all z-10"
            >
              <MicOff className="w-10 h-10 text-white" />
            </button>
          </div>
          <p className="text-red-600 font-semibold text-lg flex items-center justify-center gap-2 mt-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-rec-dot" />
            Grabando · {formatTime(recordingTime)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Presiona para detener</p>
          <div className="mt-5 text-left bg-slate-50 rounded-xl p-4 min-h-20 max-h-36 overflow-y-auto border border-slate-100" aria-live="polite">
            <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Transcripción en vivo</p>
            <p className={`text-sm leading-relaxed ${transcript ? 'text-slate-600 italic' : 'text-slate-400'}`}>
              {transcript || 'Te escucho. Tus palabras aparecerán aquí mientras respondes.'}
            </p>
          </div>
        </div>
      )}

      {phase === 'processing' && (
        <div className="interview-action-card interview-action-card--processing bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Loader2 className="w-10 h-10 text-teal-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Analizando tu respuesta...</p>
        </div>
      )}

      {/* Feedback */}
      {phase === 'feedback' && feedback && (
        <div className="interview-feedback-stack space-y-5 animate-scale-in">

          <div className="interview-feedback-card bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                {feedback.assessmentStatus === 'scored' ? 'Evaluación de IA' : feedback.assessmentStatus === 'insufficient' ? 'Respuesta insuficiente para calificar' : 'Evaluación no disponible'}
              </h3>
              {feedback.assessmentStatus === 'scored' && (
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-3xl font-bold text-teal-600">{feedback.score}</span>
                  <span className="text-slate-400 text-lg">/10</span>
                </div>
              )}
            </div>
            {feedback.assessmentStatus === 'scored'
              ? <div className="mt-4 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700" style={{ width: `${feedback.score * 10}%` }} /></div>
              : <p className="mt-2 text-sm text-slate-500">{feedback.assessmentStatus === 'insufficient' ? 'No asignamos una nota porque faltó información para valorar tu respuesta.' : 'No se generó una nota. Puedes volver a intentar el análisis.'}</p>}
          </div>

          {feedback.source === 'local' && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              {feedback.sourceReason || 'La IA no estuvo disponible.'} La guía de esta pregunta es general; no analiza ni califica tu respuesta.
            </p>
          )}

          {!responseSaved && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
              <p className="text-sm text-amber-800">Aún no se guardó esta respuesta. Reintenta para conservarla y poder retomarla después.</p>
              <button type="button" onClick={retrySaveResponse} disabled={savingResponse} className="flow-secondary disabled:opacity-60">
                {savingResponse ? 'Guardando…' : 'Reintentar guardado'}
              </button>
            </div>
          )}

          <div className="interview-feedback-card bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              Retroalimentación
            </h3>
            <div className="whitespace-pre-line text-sm text-slate-600 leading-relaxed">
              {feedback.feedback}
            </div>
          </div>

          <div className="interview-feedback-card interview-feedback-card--accent bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Consejos para mejorar
            </h3>
            <div className="whitespace-pre-line text-sm text-slate-700 leading-relaxed">
              {feedback.tips}
            </div>
          </div>

          <div className="interview-feedback-card bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Volume2 className="w-5 h-5 text-slate-400" />
              Tu respuesta
            </h3>
            <p className="text-sm text-slate-600 italic">{transcript || '(sin transcripción)'}</p>
          </div>

          {feedback.idealExample && (
            <div className="interview-feedback-card interview-feedback-card--accent bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl border border-teal-100 p-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-teal-500" />
                Ejemplo de respuesta ideal
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed italic">
                {feedback.idealExample}
              </p>
            </div>
          )}

          {feedback.assessmentStatus === 'insufficient' && (
            <button
              type="button"
              onClick={() => { setError(null); setFeedback(null); setResponseSaved(true); setPhase('idle'); }}
              className="flow-secondary w-full"
            >
              Grabar una respuesta más completa
            </button>
          )}
          {feedback.source === 'local' && (
            <button type="button" onClick={() => setPhase('processing')} className="flow-secondary w-full">
              Reintentar análisis con IA
            </button>
          )}

          <button
            onClick={nextQuestion}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all"
          >
            {isLast ? 'Finalizar sesión' : 'Siguiente pregunta'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
