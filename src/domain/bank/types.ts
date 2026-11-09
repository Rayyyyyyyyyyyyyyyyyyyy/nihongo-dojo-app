import type { Level } from '../progress/state'
export interface Vocab {
  w: string
  r: string
  zh: string
  en: string
}
export interface Question {
  q: string
  answer: string
  distractors: string[]
  explanation: string
}
export interface Grammar extends Question {
  id: string
}
export interface Reading {
  id: string
  level: Level
  title: string
  type: string
  text: string
  notes: { term: string; meaning: string }[]
  questions: (Question & { id: string })[]
}
export interface Listening extends Question {
  id: string
  level: Level
  script: string
}
export interface Banks {
  vocab: Vocab
  grammar: Grammar
  reading: Reading
  listening: Listening
}
export type BankKind = keyof Banks
