import { bankManifest, loadLevel } from '../data/bank'
import { dayKey, itemKey, type LearningInput, type StudyItemRef } from '../domain/learning/types'
import web from '../domain/progress/__fixtures__/web-v5.json'
import { importWebV5Code } from '../domain/progress/importCode'
import {
  applyImport,
  applyRestore,
  currentStreak,
  ensurePlan,
  isGoalComplete,
  openChest,
  plannedReminders,
  refreshDay,
  shouldOfferReminder,
  submitAnswer,
} from './core'
import { todayProgress } from '../screens/dojo/selectors'
import { createDoc, portable, type AppStateDoc } from './doc'

const on = (day: string, hour = 12) => () => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour)
}
let seq = 0
const answer = (ref: StudyItemRef, correct = true): LearningInput => ({
  attemptId: `a${++seq}`,
  ref,
  mode: ref.kind === 'vocab' ? 'pronunciation' : (ref.kind as LearningInput['mode']),
  correct,
})
const W = { level: 'n3', kind: 'vocab', id: '連なる' } as const
const G = { level: 'n3', kind: 'grammar', id: 'g-n3-001' } as const
const fresh = (day = '2026-11-01') => createDoc('install-1', on(day))
const submit = (doc: AppStateDoc, day: string, ref: StudyItemRef, correct = true) =>
  submitAnswer(doc, answer(ref, correct), on(day))

describe('submitAnswer：學習規則與獎賞在同一交易', () => {
  test('第一次答對 +10，同日重做 0；學習紀錄與 XP 一起進入 next doc', () => {
    const a = submit(fresh(), '2026-11-01', W)
    expect(a.outcome?.xp).toBe(10)
    expect(a.doc.rewards.xpTotal).toBe(10)
    expect(a.doc.learning.results).toHaveLength(1)
    expect(a.doc.learning.schedules[itemKey(W)].stage).toBe(1)
    const b = submit(a.doc, '2026-11-01', W, false)
    expect(b.outcome?.xp).toBe(0)
    expect(b.doc.learning.results).toHaveLength(2)
  })

  test('翻卡自評 0 XP、不進錯題、不掌握；讀音測驗才給 XP 並掌握', () => {
    const flash = (correct: boolean) => ({ ...answer(W, correct), mode: 'flashcard' as const })
    const a = submitAnswer(fresh(), flash(true), on('2026-11-01'))
    expect(a.outcome?.xp).toBe(0)
    expect(a.doc.rewards.xpTotal).toBe(0)
    expect(a.doc.learning.schedules[itemKey(W)].stage).toBe(1)
    expect(Object.hasOwn(a.doc.learning.vKnown.n3, W.id)).toBe(false)
    const b = submitAnswer(a.doc, flash(false), on('2026-11-01'))
    expect(b.outcome?.xp).toBe(0)
    expect(b.doc.learning.mistakes).toEqual({})
    const c = submitAnswer(b.doc, { ...answer(W), mode: 'pronunciation' }, on('2026-11-02'))
    expect(c.outcome?.xp).toBe(10)
    expect(Object.hasOwn(c.doc.learning.vKnown.n3, W.id)).toBe(true)
  })

  test('無效或重複的提交不改文件、不給 XP', () => {
    const input = answer(W)
    const a = submitAnswer(fresh(), input, on('2026-11-01'))
    const again = submitAnswer(a.doc, input, on('2026-11-01'))
    expect(again).toEqual({ doc: a.doc, outcome: null })
    const bad = submitAnswer(a.doc, { ...answer(W), mode: 'grammar' }, on('2026-11-01'))
    expect(bad.outcome).toBeNull()
  })

  test('移植的單字排程決定 +15：到期日答對推進到新 stage；未到期 +3', () => {
    let doc = submit(fresh(), '2026-11-01', W).doc // stage 1，11-02 到期
    const due = submit(doc, '2026-11-02', W) // stage 2，11-05 到期
    expect(due.outcome?.xp).toBe(15)
    doc = due.doc
    expect(submit(doc, '2026-11-03', W).outcome?.xp).toBe(3)
  })

  test('文法沒有排程：首次答對 +10，之後 +3', () => {
    const a = submit(fresh(), '2026-11-01', G)
    expect(a.outcome?.xp).toBe(10)
    expect(submit(a.doc, '2026-11-02', G).outcome?.xp).toBe(3)
  })

  test('跨過段位門檻時回傳升段儀式（只播一次）', () => {
    const doc = { ...fresh(), rewards: { ...fresh().rewards, xpTotal: 195 } }
    const a = submit(doc, '2026-11-01', W)
    expect(a.outcome?.ceremony).toEqual({ rank: 2, passed: [2] })
    expect(submit(a.doc, '2026-11-01', G).outcome?.ceremony).toBeNull()
  })
})

describe('今日任務完成 → recordGoalCompleted → 寶箱', () => {
  const bank = loadLevel('n5')
  test('今天任務的每組目標都有效完成時只回報一次完成；完成後可開寶箱，第一次固定初稽古印', () => {
    let doc: AppStateDoc = { ...fresh(), learning: { ...fresh().learning, level: 'n5' } }
    doc = ensurePlan(doc, 'listening', on('2026-11-01'), bank, bankManifest)
    const plan = doc.learning.plans[dayKey('2026-11-01', 'n5')]
    const targets = [...plan.groups.vocab!.targets, ...plan.groups.grammar!.targets, ...plan.groups.listening!.targets]
    expect(targets.length).toBe(10 + 5 + 3)
    expect(openChest(doc, on('2026-11-01'))).toBeNull()
    const completed: boolean[] = []
    for (const ref of targets) {
      const r = submitAnswer(doc, answer(ref, ref.kind !== 'grammar'), on('2026-11-01'), bank)
      completed.push(r.outcome!.goalCompleted)
      doc = r.doc
    }
    expect(completed.filter(Boolean)).toHaveLength(1)
    expect(completed[completed.length - 1]).toBe(true)
    expect(doc.rewards.goalCompletedDates).toEqual(['2026-11-01'])
    expect(openChest(doc, on('2026-11-01'))?.result).toEqual({ type: 'firstStamp' })
    // 加練不再回報完成
    expect(submitAnswer(doc, answer(targets[0]), on('2026-11-01'), bank).outcome?.goalCompleted).toBe(false)
  })

  describe('翻卡自評不計今日目標（2026-11-11 使用者決定）', () => {
    const flash = (ref: StudyItemRef, correct = true): LearningInput => ({ ...answer(ref, correct), mode: 'flashcard' })
    const day1 = () =>
      ensurePlan({ ...fresh(), learning: { ...fresh().learning, level: 'n5' } }, 'listening', on('2026-11-01'), bank, bankManifest)
    const progress = (doc: AppStateDoc) => todayProgress(doc, bank, '2026-11-01')!

    test('只翻卡：目標進度不動、不完成、開不了寶箱，但仍維持連勝', () => {
      let doc = day1()
      for (const ref of doc.learning.plans[dayKey('2026-11-01', 'n5')].groups.vocab!.targets) {
        const r = submitAnswer(doc, flash(ref), on('2026-11-01'), bank)
        expect(r.outcome!.goalCompleted).toBe(false)
        doc = r.doc
      }
      expect(progress(doc).done).toBe(0)
      expect(isGoalComplete(doc.learning, '2026-11-01', bank)).toBe(false)
      expect(openChest(doc, on('2026-11-01'))).toBeNull()
      expect(doc.learning.streak).toBe(1)
      expect(doc.learning.lastDate).toBe('2026-11-01')
    })

    test('第一天（單字全是新字）：翻卡後做完文法與聽力即可完成目標；單字不擋', () => {
      let doc = day1()
      const p = doc.learning.plans[dayKey('2026-11-01', 'n5')]
      for (const ref of p.groups.vocab!.targets) doc = submitAnswer(doc, flash(ref), on('2026-11-01'), bank).doc
      const total = progress(doc).total
      expect(total).toBe(5 + 3)
      let last = false
      for (const ref of [...p.groups.grammar!.targets, ...p.groups.listening!.targets]) {
        const r = submitAnswer(doc, answer(ref), on('2026-11-01'), bank)
        doc = r.doc
        last = r.outcome!.goalCompleted
      }
      expect(last).toBe(true)
      expect(openChest(doc, on('2026-11-01'))).not.toBeNull()
    })

    test('已排程單字要讀音測驗答過才算進度；翻卡不算', () => {
      const w = day1().learning.plans[dayKey('2026-11-01', 'n5')].groups.vocab!.targets[0]
      let doc = submit(day1(), '2026-11-01', w).doc // 已排程，11-02 到期
      doc = ensurePlan(doc, 'listening', on('2026-11-02'), bank, bankManifest)
      expect(doc.learning.plans[dayKey('2026-11-02', 'n5')].groups.vocab!.targets.map((t) => t.id)).toContain(w.id)
      const at = (d: AppStateDoc) => todayProgress(d, bank, '2026-11-02')!.done
      const flashed = submitAnswer(doc, flash(w), on('2026-11-02'), bank).doc
      expect(at(flashed)).toBe(at(doc))
      expect(at(submitAnswer(doc, answer(w), on('2026-11-02'), bank).doc)).toBe(at(doc) + 1)
    })
  })

  test('ensurePlan 已開始的分支不會被換掉；任務已齊時不產生新文件', () => {
    const doc = ensurePlan({ ...fresh(), learning: { ...fresh().learning, level: 'n5' as const } }, 'reading', on('2026-11-01'), bank, bankManifest)
    expect(ensurePlan(doc, 'reading', on('2026-11-01'), bank, bankManifest)).toBe(doc)
    expect(ensurePlan(doc, 'listening', on('2026-11-01'), bank, bankManifest).learning.plans[dayKey('2026-11-01', 'n5')].branch).toBe('listening')
  })
})

describe('連勝與保護卡接線', () => {
  const studied = (lastDate: string, streak: number, cards: 0 | 1 | 2) => {
    const d = fresh('2026-10-01')
    return { ...d, learning: { ...d.learning, lastDate, streak }, rewards: { ...d.rewards, protectionCards: cards } }
  }

  test('錯過 1 天且有 1 張卡：第一次提交時用卡，連勝延續 +1，保護日不算修行日', () => {
    const r = submit(studied('2026-11-08', 5, 1), '2026-11-10', W)
    expect(r.outcome?.protectedNow).toEqual(['2026-11-09'])
    expect(r.doc.learning.streak).toBe(6)
    expect(r.doc.rewards.protectionCards).toBe(0)
    expect(r.doc.rewards.goalCompletedDates).not.toContain('2026-11-09')
  })

  test('卡不夠：連勝重設為 1，卡保留不扣', () => {
    const r = submit(studied('2026-11-06', 5, 2), '2026-11-10', W)
    expect(r.doc.learning.streak).toBe(1)
    expect(r.doc.rewards.protectionCards).toBe(2)
  })

  test('新的一天第一次進前景先用卡；畫面連勝因此仍顯示原值，之後提交不重複扣', () => {
    const doc = studied('2026-11-08', 5, 2)
    expect(currentStreak(doc, '2026-11-10')).toBe(0)
    const r = refreshDay(doc, on('2026-11-10', 8))
    expect(r.protectedNow).toEqual(['2026-11-09'])
    expect(currentStreak(r.doc, '2026-11-10')).toBe(5)
    const s = submit(r.doc, '2026-11-10', W)
    expect(s.doc.learning.streak).toBe(6)
    expect(s.doc.rewards.protectionCards).toBe(1)
  })
})

describe('匯入與恢復', () => {
  test('匯入網頁版 v5 碼只覆寫 learning；XP、卡數、設定、購買狀態不動；已答對的 key 不重領 +10', () => {
    const base = fresh('2026-10-01')
    const doc: AppStateDoc = {
      ...base,
      rewards: { ...base.rewards, xpTotal: 500, protectionCards: 2 },
      settings: { ...base.settings, dailyMinutes: 20 },
      entitlement: { ...base.entitlement, owned: true, verifiedAt: '2026-10-02T00:00:00.000Z' },
    }
    const next = applyImport(doc, importWebV5Code(web.code), '2026-11-09')
    expect(next.learning).toEqual(web.state)
    expect(next.rewards.xpTotal).toBe(500)
    expect(next.rewards.protectionCards).toBe(2)
    expect(next.rewards.protectionBaselineDate).toBe('2026-11-09')
    expect(next.settings).toEqual(doc.settings)
    expect(next.entitlement).toEqual(doc.entitlement)
    const grammar = { level: 'n3', kind: 'grammar', id: 'g-n3-005' } as const
    expect(submit(next, '2026-11-09', grammar).outcome?.xp).toBe(3)
    // 只答錯過的 key 之後第一次答對仍 +10
    expect(submit(next, '2026-11-09', { level: 'n3', kind: 'grammar', id: 'g-n3-021' }).outcome?.xp).toBe(10)
  })

  test('審查 F5：匯入 lastDate 為 10 天前的 v5 碼，隔天開 App 不扣卡；下一次提交連勝重設為 1', () => {
    const base = fresh('2026-10-01')
    const doc = { ...base, rewards: { ...base.rewards, protectionCards: 2 as const } }
    const learning = { ...importWebV5Code(web.code), lastDate: '2026-10-30', streak: 9 }
    const imported = applyImport(doc, learning, '2026-11-09')
    expect(imported.learning.streak).toBe(9) // 匯入當下不改數字
    const opened = refreshDay(imported, on('2026-11-10', 8))
    expect(opened.protectedNow).toEqual([])
    expect(opened.doc.rewards.protectionCards).toBe(2)
    const s = submit(opened.doc, '2026-11-10', W)
    expect(s.doc.learning.streak).toBe(1)
    expect(s.doc.rewards.protectionCards).toBe(2)
  })

  test('恢復快照套回完整文件，但購買狀態沿用當前、保護卡基線設為當天', () => {
    const old = fresh('2026-10-01')
    const now = { ...submit(old, '2026-11-01', W).doc, entitlement: { ...old.entitlement, owned: true } }
    const r = applyRestore(now, portable(old), '2026-11-09')
    expect(r.learning).toEqual(old.learning)
    expect(r.entitlement.owned).toBe(true)
    expect(r.rewards.protectionBaselineDate).toBe('2026-11-09')
  })
})

describe('提醒接線', () => {
  test('連勝 ≥3、今天未練才排提醒；今天練過後不排今天', () => {
    const d = fresh('2026-10-01')
    const doc = {
      ...d,
      learning: { ...d.learning, lastDate: '2026-11-09', streak: 3 },
      settings: { ...d.settings, reminder: { ...d.settings.reminder, enabled: true } },
    }
    expect(plannedReminders(doc, on('2026-11-10', 9))[0]).toEqual(new Date(2026, 10, 10, 20, 0))
    const practiced = submit(doc, '2026-11-10', W).doc
    expect(plannedReminders(practiced, on('2026-11-10', 9))[0]).toEqual(new Date(2026, 10, 11, 20, 0))
  })

  test('提醒說明卡只在第一次完成今日任務後出現，「之後再說」三天內不再出現', () => {
    const d = fresh()
    expect(shouldOfferReminder(d, '2026-11-01')).toBe(false)
    const done = { ...d, rewards: { ...d.rewards, goalCompletedDates: ['2026-11-01'] } }
    expect(shouldOfferReminder(done, '2026-11-01')).toBe(true)
    const later = { ...done, settings: { ...done.settings, reminder: { ...done.settings.reminder, askAfter: '2026-11-04' } } }
    expect(shouldOfferReminder(later, '2026-11-03')).toBe(false)
    expect(shouldOfferReminder(later, '2026-11-04')).toBe(true)
  })
})
