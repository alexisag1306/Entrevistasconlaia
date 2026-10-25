export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'todos';

export type RoleFocus = 'general' | 'web' | 'backend' | 'bd';

export type SessionType = 'tecnica' | 'conductual' | 'mixta';

export type QuestionCount = 5 | 10 | 15;

export interface Profile {
  id: string;
  full_name: string;
  career_field: string;
  experience_level: ExperienceLevel;
  created_at: string;
  updated_at: string;
}

export interface InterviewQuestion {
  id: string;
  category: string;
  question_text: string;
  difficulty: string;
  tips: string;
  phase: number;
  role: RoleFocus;
  experience_level: ExperienceLevel;
}

export interface SessionConfig {
  mode: 'voice' | 'text';
  role_focus: RoleFocus;
  session_type: SessionType;
  question_count: QuestionCount;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  mode: 'voice' | 'text';
  role_focus: RoleFocus;
  session_type: SessionType;
  question_count: QuestionCount;
  question_ids: string[];
  current_question_index: number;
  experience_level: ExperienceLevel;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
}

export interface SessionResponse {
  id: string;
  session_id: string;
  user_id: string;
  question_id: string | null;
  question_text: string;
  response_text: string;
  response_mode: 'voice' | 'text';
  ai_feedback: string;
  ai_score: number;
  ai_tips: string;
  duration_seconds: number;
  created_at: string;
}

export interface AIFeedback {
  score: number;
  assessmentStatus: 'scored' | 'insufficient' | 'unavailable';
  feedback: string;
  tips: string;
  idealExample?: string;
  source?: 'ai' | 'local';
  sourceReason?: string;
}

export interface AIFeedbackContext {
  question: string;
  answer: string;
  questionTips: string;
  phase: number;
  category: string;
  responseMode: 'voice' | 'text';
  roleFocus: RoleFocus;
  experienceLevel: ExperienceLevel;
  durationSeconds?: number;
  sessionHistory?: { question: string; score: number }[];
}
