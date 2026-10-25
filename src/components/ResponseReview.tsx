import { ChevronDown, FileText, Lightbulb, MessageSquareText, Star } from 'lucide-react';
import type { SessionResponse } from '@/types';

export default function ResponseReview({ response, index }: { response: SessionResponse; index?: number }) {
  const isLocalGuide = response.ai_score === 0 && response.ai_feedback.startsWith('Guía local orientativa');
  const isInsufficient = response.ai_score === 0 && response.ai_feedback.startsWith('Respuesta insuficiente para calificar');

  return (
    <details className="response-review group">
      <summary className="response-review-summary">
        {typeof index === 'number' && <span className="response-review-index">{String(index).padStart(2, '0')}</span>}
        <span className="response-review-question">{response.question_text}</span>
        <span className={`response-review-score ${response.ai_score > 0 ? 'has-score' : ''}`}>
          {response.ai_score > 0 ? <><Star className="h-3.5 w-3.5" /> {response.ai_score}/10</> : isLocalGuide ? 'Guía local' : isInsufficient ? 'Insuficiente' : 'Sin calificación'}
        </span>
        <ChevronDown className="response-review-chevron h-4 w-4" aria-hidden="true" />
      </summary>

      <div className="response-review-content">
        <section className="response-review-section">
          <h3><FileText className="h-4 w-4" /> Tu respuesta</h3>
          <p>{response.response_text?.trim() || 'No se guardó una respuesta para esta pregunta.'}</p>
        </section>

        <section className="response-review-section">
          <h3><MessageSquareText className="h-4 w-4" /> Retroalimentación</h3>
          <p>{response.ai_feedback?.trim() || 'No hay retroalimentación guardada.'}</p>
        </section>

        {response.ai_tips?.trim() && (
          <section className="response-review-section response-review-tip">
            <h3><Lightbulb className="h-4 w-4" /> Siguiente paso</h3>
            <p>{response.ai_tips}</p>
          </section>
        )}

        <p className="response-review-meta">
          {response.response_mode === 'voice' ? 'Práctica por voz' : 'Práctica por texto'}
          {' · '}
          {new Date(response.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>
    </details>
  );
}
