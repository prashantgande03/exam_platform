import { create } from 'zustand'

export const useAuth = create((set) => ({
  token: null,
  role: null,
  username: null,
  setAuth: (token, role, username) => set({ token, role, username }),
  logout: () => set({ token: null, role: null, username: null }),
}))

export const useExam = create((set) => ({
  startedAt: null,
  durationSec: 15 * 60, // 15 min default
  answers: {}, // { [questionId]: text }
  setDuration: (sec) => set({ durationSec: sec }),
  start: () => set({ startedAt: Date.now() }),
  setAnswer: (qid, text) => set((s) => ({ answers: { ...s.answers, [qid]: text } })),
  reset: () => set({ startedAt: null, answers: {} }),
}))
