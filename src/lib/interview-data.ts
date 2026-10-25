import { supabase } from '@/lib/supabase';
import { normalizeExperienceLevel } from '@/lib/experience-level';
import type { ExperienceLevel, InterviewQuestion, InterviewSession, QuestionCount, RoleFocus, SessionResponse, SessionType } from '@/types';

interface InterviewQuestionPool {
  questions: InterviewQuestion[];
  recentlyAnsweredIds: Set<string>;
  experienceLevel: ExperienceLevel;
  error: boolean;
}

/** Loads the shared question bank and the user's recent question history. */
export async function loadInterviewQuestionPool(userId: string): Promise<InterviewQuestionPool> {
  try {
    const [recentResult, questionResult, profileResult] = await Promise.all([
      supabase.from('session_responses')
        .select('question_id')
        .eq('user_id', userId)
        .not('question_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('interview_questions').select('*'),
      supabase.from('profiles').select('experience_level').eq('id', userId).maybeSingle(),
    ]);

    const recentlyAnsweredIds = new Set<string>(
      (recentResult.data ?? []).map(response => response.question_id).filter((id): id is string => Boolean(id)),
    );
    const questions = (questionResult.data ?? []) as InterviewQuestion[];

    return {
      questions,
      recentlyAnsweredIds,
      experienceLevel: normalizeExperienceLevel(profileResult.data?.experience_level),
      error: Boolean(questionResult.error) || questions.length === 0,
    };
  } catch {
    return { questions: [], recentlyAnsweredIds: new Set(), experienceLevel: 'junior', error: true };
  }
}

export async function createInterviewSession(input: {
  userId: string;
  mode: 'voice' | 'text';
  role: RoleFocus;
  sessionType: SessionType;
  questionCount: QuestionCount;
  questions: InterviewQuestion[];
  experienceLevel: ExperienceLevel;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('interview_sessions').insert({
      user_id: input.userId,
      mode: input.mode,
      role_focus: input.role,
      session_type: input.sessionType,
      question_count: input.questions.length || input.questionCount,
      question_ids: input.questions.map(question => question.id),
      experience_level: input.experienceLevel,
      current_question_index: 0,
      status: 'in_progress',
    }).select('id').single();

    return error ? null : data?.id ?? null;
  } catch {
    return null;
  }
}

export async function loadInterviewSession(userId: string, sessionId: string): Promise<InterviewSession | null> {
  try {
    const { data, error } = await supabase.from('interview_sessions').select('*')
      .eq('id', sessionId).eq('user_id', userId).maybeSingle();
    return error || !data ? null : data as InterviewSession;
  } catch {
    return null;
  }
}

export async function loadInterviewResponses(userId: string, sessionId: string): Promise<SessionResponse[] | null> {
  try {
    const { data, error } = await supabase.from('session_responses').select('*')
      .eq('session_id', sessionId).eq('user_id', userId).order('created_at', { ascending: true });
    return error ? null : (data as SessionResponse[] ?? []);
  } catch {
    return null;
  }
}

export async function updateInterviewSessionProgress(
  userId: string,
  sessionId: string,
  currentQuestionIndex: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('interview_sessions')
      .update({ current_question_index: currentQuestionIndex })
      .eq('id', sessionId).eq('user_id', userId).eq('status', 'in_progress')
      .select('id').maybeSingle();
    return !error && data?.id === sessionId;
  } catch {
    return false;
  }
}

export async function completeInterviewSession(
  userId: string,
  sessionId: string,
  currentQuestionIndex: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('interview_sessions').update({
      current_question_index: currentQuestionIndex,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', sessionId).eq('user_id', userId).eq('status', 'in_progress')
      .select('id').maybeSingle();
    return !error && data?.id === sessionId;
  } catch {
    return false;
  }
}

export async function abandonInterviewSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('interview_sessions').update({
      status: 'abandoned',
      abandoned_at: new Date().toISOString(),
    }).eq('id', sessionId).eq('user_id', userId).eq('status', 'in_progress')
      .select('id').maybeSingle();
    return !error && data?.id === sessionId;
  } catch {
    return false;
  }
}
