import type { QuestionCount, RoleFocus, SessionType } from '@/types';

export interface InterviewConfig {
  role: RoleFocus;
  sessionType: SessionType;
  count: QuestionCount;
}

const roles = new Set<RoleFocus>(['general', 'web', 'backend', 'bd']);
const sessionTypes = new Set<SessionType>(['mixta', 'tecnica', 'conductual']);
const questionCounts = new Set<number>([5, 10, 15]);

/** Parses query parameters without trusting values copied or edited in the URL. */
export function parseInterviewConfig(params: Pick<URLSearchParams, 'get'>): InterviewConfig | null {
  const rawRole = params.get('role');
  const rawType = params.get('type');
  const rawCount = params.get('count');
  const isResume = Boolean(params.get('sessionId'));

  const role = rawRole === null ? 'general' : rawRole;
  const sessionType = rawType === null ? 'mixta' : rawType;
  const parsedCount = rawCount === null ? 10 : Number(rawCount);
  const countIsValid = questionCounts.has(parsedCount)
    || (isResume && Number.isInteger(parsedCount) && parsedCount >= 2 && parsedCount <= 50);

  if (!roles.has(role as RoleFocus) || !sessionTypes.has(sessionType as SessionType) || !countIsValid) {
    return null;
  }

  return {
    role: role as RoleFocus,
    sessionType: sessionType as SessionType,
    count: parsedCount as QuestionCount,
  };
}
