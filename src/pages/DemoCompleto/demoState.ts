import { createContext, useContext } from 'react';
import type { DemoMaterial, DemoQuestion, DemoTask, Subject } from './demoData';
export type Panel =
  | { kind: 'lesson'; subject: Subject }
  | { kind: 'subject'; subject: Subject }
  | { kind: 'quiz'; items: DemoQuestion[]; simulation?: boolean }
  | { kind: 'material'; material: DemoMaterial }
  | { kind: 'review'; id: string }
  | { kind: 'task' }
  | { kind: 'plan' }
  | { kind: 'profile' }
  | { kind: 'mentor' }
  | { kind: 'result'; score: number; title: string }
  | { kind: 'search' }
  | { kind: 'notifications' };
export interface LabState {
  tasks: DemoTask[]; toggleTask: (id: string) => void; addTask: (task: DemoTask) => void;
  selectedDate: string; selectDate: (date: string) => void;
  completedLessons: string[]; completeLesson: (id: string) => void;
  activeStudy: string | null; studyStartedAt: number | null; startStudy: (id: string) => void; skipStudy: (id: string) => void;
  completedReviews: string[]; completeReview: (id: string) => void;
  favorites: string[]; toggleFavorite: (id: string) => void;
  downloads: string[]; download: (material: DemoMaterial) => void;
  answers: Record<string, boolean>; answer: (id: string, correct: boolean) => void;
  goal: number; setGoal: (hours: number) => void;
  notes: Record<string, string>; setNote: (id: string, text: string) => void;
  open: (panel: Panel) => void; close: () => void;
  go: (page: string) => void; notify: (text: string) => void;
}
export const LabContext = createContext<LabState | null>(null);
export function useLab() {
  const state = useContext(LabContext);
  if (!state) throw new Error('A demonstração precisa do seu contexto local.');
  return state;
}
