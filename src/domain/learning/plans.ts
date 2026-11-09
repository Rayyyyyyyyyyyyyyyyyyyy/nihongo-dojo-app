import type { Banks } from '../bank/types'
import type { ProgressState, Level } from '../progress/state'
import {
  dayKey,
  itemKey,
  taskLimit,
  type StudyItemRef,
  type StudyKind,
  type DailyGroup,
  type DailyPlan,
} from './types'
export function refsFor<K extends StudyKind>(
  kind: K,
  level: Level,
  items: Banks[K][],
): StudyItemRef[] {
  return [
    ...new Map(
      items.map((item) => {
        const id = kind === 'vocab' ? (item as Banks['vocab']).w : (item as Banks['grammar']).id
        const ref: StudyItemRef = {
          level,
          kind,
          id,
          ...(kind === 'reading' ? { articleId: id } : {}),
        }
        return [itemKey(ref), ref]
      }),
    ).values(),
  ]
}
export function priority(state: ProgressState, ref: StudyItemRef, today: string): [number, string] {
  const key = itemKey(ref),
    { level, kind, id } = ref,
    schedule = state.schedules[key]
  if (kind === 'vocab') {
    if (schedule && schedule.dueOn <= today) return [0, schedule.dueOn]
    if (!schedule && (state.mistakes[key]?.pending || Object.hasOwn(state.vLearning[level], id)))
      return [1, '']
    if (
      !Object.hasOwn(state.vKnown[level], id) &&
      !Object.hasOwn(state.vLearning[level], id) &&
      !schedule
    )
      return [2, '']
    return [3, '']
  }
  if (kind === 'grammar')
    return [state.mistakes[key]?.pending ? 0 : state.gDone[level].includes(id) ? 2 : 1, '']
  return [
    (kind === 'reading' ? state.rDone[level] : state.lCorrect[level]).includes(id) ? 1 : 0,
    '',
  ]
}
export function orderRefs(
  state: ProgressState,
  refs: StudyItemRef[],
  today: string,
): StudyItemRef[] {
  return [...refs].sort((a, b) => {
    const pa = priority(state, a, today),
      pb = priority(state, b, today)
    return pa[0] - pb[0] || pa[1].localeCompare(pb[1]) || itemKey(a).localeCompare(itemKey(b))
  })
}
export function generateGroup(
  state: ProgressState,
  refs: StudyItemRef[],
  kind: StudyKind,
  today: string,
): DailyGroup {
  const targets = orderRefs(state, refs, today).slice(0, taskLimit[kind])
  return { status: targets.length ? 'ready' : 'empty', targets, note: '' }
}
export function inspectGroup<K extends StudyKind>(
  state: ProgressState,
  plan: DailyPlan,
  kind: K,
  items?: Banks[K][],
) {
  const targets = plan.groups[kind]?.targets ?? [],
    day = state.days[dayKey(plan.date, plan.level)],
    resolved = targets.map((ref) => ({
      ref,
      item: items?.find((item) =>
        kind === 'vocab'
          ? (item as Banks['vocab']).w === ref.id
          : (item as Banks['grammar']).id === ref.id,
      ),
    })),
    missing = items === undefined ? [] : resolved.filter((x) => !x.item).map((x) => x.ref),
    valid = resolved.filter((x) => items === undefined || x.item),
    done = (ref: StudyItemRef) =>
      kind === 'reading' ? day?.articles.includes(ref.id) : day?.items.includes(itemKey(ref))
  return {
    done: valid.filter((x) => done(x.ref)).length,
    total: targets.length,
    correct: valid.filter(({ ref }) =>
      kind === 'reading'
        ? state.rDone[plan.level].includes(ref.id)
        : day?.correctItems.includes(itemKey(ref)),
    ).length,
    complete:
      items !== undefined &&
      targets.length > 0 &&
      !missing.length &&
      valid.every((x) => done(x.ref)),
    missing,
    selected: valid.flatMap(({ ref, item }) => (item && !done(ref) ? [item] : [])),
  }
}
export function repairGroup<K extends StudyKind>(
  state: ProgressState,
  plan: DailyPlan,
  kind: K,
  items: Banks[K][],
): DailyGroup | undefined {
  const old = plan.groups[kind]
  if (!old) return
  const missing = new Set(inspectGroup(state, plan, kind, items).missing.map(itemKey)),
    keep = old.targets.filter((r) => !missing.has(itemKey(r))),
    kept = new Set(keep.map(itemKey)),
    replacement = orderRefs(
      state,
      refsFor(kind, plan.level, items).filter((r) => !kept.has(itemKey(r))),
      plan.date,
    ).slice(0, Math.min(taskLimit[kind], old.targets.length) - keep.length),
    targets = [...keep, ...replacement]
  return {
    status: targets.length ? 'ready' : 'empty',
    targets,
    note: `已修復 ${missing.size} 個失效目標；目前 ${targets.length} 題，原有效目標及完成量保留。`,
  }
}
export function vocabQueue(
  items: Banks['vocab'][],
  state: ProgressState,
  level: Level,
  today: string,
  dueOnly = false,
) {
  let refs = refsFor('vocab', level, items)
  if (dueOnly) refs = refs.filter((r) => state.schedules[itemKey(r)]?.dueOn <= today)
  return orderRefs(state, refs, today)
    .slice(0, 10)
    .map((r) => items.find((v) => v.w === r.id)!)
}
