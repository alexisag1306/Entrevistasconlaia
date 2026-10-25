import type { ExperienceLevel, InterviewQuestion, RoleFocus, SessionType } from '@/types';

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function pickQuestions(
  questions: InterviewQuestion[],
  count: number,
  recentlyAnsweredIds: Set<string>,
  experienceLevel: ExperienceLevel,
): InterviewQuestion[] {
  const targeted = experienceLevel === 'todos'
    ? []
    : questions.filter(question => question.experience_level === experienceLevel);
  const common = questions.filter(question => question.experience_level === 'todos');
  const unseenTargeted = targeted.filter(question => !recentlyAnsweredIds.has(question.id));
  const unseenCommon = common.filter(question => !recentlyAnsweredIds.has(question.id));
  const seenTargeted = targeted.filter(question => recentlyAnsweredIds.has(question.id));
  const seenCommon = common.filter(question => recentlyAnsweredIds.has(question.id));
  return [
    ...shuffle(unseenTargeted),
    ...shuffle(unseenCommon),
    ...shuffle(seenTargeted),
    ...shuffle(seenCommon),
  ].slice(0, count);
}

/** Builds the same ordered interview for voice and text modes. */
export function buildQuestionQueue(
  questions: InterviewQuestion[],
  role: RoleFocus,
  sessionType: SessionType,
  requestedCount: number,
  recentlyAnsweredIds = new Set<string>(),
  experienceLevel: ExperienceLevel = 'todos',
): InterviewQuestion[] {
  const count = Math.max(2, Math.floor(requestedCount));
  const middleCount = count - 2;
  const openings = questions.filter(question => question.phase === 1);
  const behaviorals = questions.filter(question => question.phase === 2);
  const technical = questions.filter(
    question => question.phase === 3 && (question.role === role || question.role === 'general'),
  );
  const closings = questions.filter(question => question.phase === 4);
  const forLevel = (pool: InterviewQuestion[]) => pool.filter(question =>
    question.experience_level === 'todos' || question.experience_level === experienceLevel,
  );

  const behavioralCount = sessionType === 'tecnica'
    ? 0
    : sessionType === 'conductual'
      ? middleCount
      : Math.floor(middleCount * 0.4);
  const technicalCount = middleCount - behavioralCount;

  return [
    ...pickQuestions(forLevel(openings), 1, recentlyAnsweredIds, experienceLevel),
    ...pickQuestions(forLevel(behaviorals), behavioralCount, recentlyAnsweredIds, experienceLevel),
    ...pickQuestions(forLevel(technical), technicalCount, recentlyAnsweredIds, experienceLevel),
    ...pickQuestions(forLevel(closings), 1, recentlyAnsweredIds, experienceLevel),
  ];
}
