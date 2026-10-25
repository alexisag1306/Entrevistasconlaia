import { supabase } from '@/lib/supabase';
import type { AIFeedback, InterviewQuestion } from '@/types';

interface SaveSessionResponseInput {
  sessionId: string;
  userId: string;
  question: InterviewQuestion;
  responseText: string;
  responseMode: 'voice' | 'text';
  feedback: AIFeedback;
  durationSeconds: number;
}

/** Persists voice and text answers with the same schema and score semantics. */
export async function saveSessionResponse({
  sessionId,
  userId,
  question,
  responseText,
  responseMode,
  feedback,
  durationSeconds,
}: SaveSessionResponseInput): Promise<boolean> {
  try {
    const { error } = await supabase.from('session_responses').upsert({
      session_id: sessionId,
      user_id: userId,
      question_id: question.id,
      question_text: question.question_text,
      response_text: responseText,
      response_mode: responseMode,
      ai_feedback: feedback.source === 'local'
        ? `Guía local orientativa (la IA no estaba disponible).\n\n${feedback.feedback}`
        : feedback.assessmentStatus === 'insufficient'
          ? `Respuesta insuficiente para calificar.\n\n${feedback.feedback}`
          : feedback.feedback,
      ai_score: feedback.source === 'ai' && feedback.assessmentStatus !== 'insufficient' ? feedback.score : 0,
      ai_tips: feedback.tips,
      duration_seconds: durationSeconds,
    }, { onConflict: 'session_id,question_id' });
    return !error;
  } catch {
    return false;
  }
}
