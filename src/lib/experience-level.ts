import type { ExperienceLevel } from '@/types';

/** Keeps older or unexpected profile values from breaking question selection and feedback. */
export function normalizeExperienceLevel(value: unknown): ExperienceLevel {
  return value === 'mid' || value === 'senior' || value === 'todos' ? value : 'junior';
}
