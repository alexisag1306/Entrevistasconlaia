import {
  ArrowRight, CheckCircle2, FileText, Lightbulb, Sparkles, Star, Volume2,
} from 'lucide-react';
import type { AIFeedback } from '@/types';

interface InterviewFeedbackProps {
  feedback: AIFeedback;
  response: string;
  responseMode: 'voice' | 'text';
  responseSaved: boolean;
  savingResponse: boolean;
  isLast: boolean;
  onRetrySave: () => void;
  onRetryAI?: () => void;
  onImproveAnswer?: () => void;
  onNext: () => void;
}

export default function InterviewFeedback({
  feedback,
  response,
  responseMode,
  responseSaved,
  savingResponse,
  isLast,
  onRetrySave,
  onRetryAI,
  onImproveAnswer,
  onNext,
}: InterviewFeedbackProps) {
  const ResponseIcon = responseMode === 'voice' ? Volume2 : FileText;

  return (
    <div className="interview-feedback-stack space-y-5 animate-scale-in">
      <section className="interview-feedback-card interview-feedback-card--score bg-white rounded-2xl border border-slate-200 p-6" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            {feedback.assessmentStatus === 'scored'
              ? 'Evaluación de IA'
              : feedback.assessmentStatus === 'insufficient'
                ? 'Respuesta insuficiente para calificar'
                : 'Evaluación no disponible'}
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
      </section>

      {feedback.source === 'local' && (
        <p className="interview-inline-notice rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {feedback.sourceReason || 'La IA no estuvo disponible.'} La guía de esta pregunta es general; no analiza ni califica tu respuesta.
        </p>
      )}

      {!responseSaved && (
        <div className="interview-inline-notice flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
          <p className="text-sm text-amber-800">Aún no se guardó esta respuesta. Reintenta para conservarla y poder retomarla después.</p>
          <button type="button" onClick={onRetrySave} disabled={savingResponse} className="flow-secondary disabled:opacity-60">
            {savingResponse ? 'Guardando…' : 'Reintentar guardado'}
          </button>
        </div>
      )}

      <section className="interview-feedback-card bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-teal-600" />
          Retroalimentación
        </h3>
        <div className="whitespace-pre-line text-sm text-slate-600 leading-relaxed">{feedback.feedback}</div>
      </section>

      <section className="interview-feedback-card interview-feedback-card--accent bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Siguiente paso para mejorar
        </h3>
        <div className="whitespace-pre-line text-sm text-slate-700 leading-relaxed">{feedback.tips}</div>
      </section>

      <section className="interview-feedback-card bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
          <ResponseIcon className="w-5 h-5 text-slate-400" />
          Tu respuesta
        </h3>
        <p className={`text-sm text-slate-600 ${responseMode === 'voice' ? 'italic' : ''}`}>{response || '(sin respuesta)'}</p>
      </section>

      {feedback.idealExample && (
        <section className="interview-feedback-card interview-feedback-card--accent bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl border border-teal-100 p-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-teal-500" />
            Estructura de ejemplo
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed italic">{feedback.idealExample}</p>
        </section>
      )}

      {feedback.assessmentStatus === 'insufficient' && onImproveAnswer && (
        <button type="button" onClick={onImproveAnswer} className="flow-secondary w-full">
          {responseMode === 'voice' ? 'Grabar una respuesta más completa' : 'Revisar y completar mi respuesta'}
        </button>
      )}
      {feedback.source === 'local' && onRetryAI && (
        <button type="button" onClick={onRetryAI} className="flow-secondary w-full">
          Reintentar análisis con IA
        </button>
      )}

      <button
        type="button"
        onClick={onNext}
        className="interview-feedback-next w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all"
      >
        {isLast ? 'Finalizar sesión' : 'Siguiente pregunta'}
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
