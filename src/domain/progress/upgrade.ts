import { defaultState, LEVELS, type LegacyState, type ProgressState } from './state'
import { itemKey } from '../learning/types'
export function upgradeV4(legacy: LegacyState, today: string): ProgressState {
  const state = { ...defaultState(), ...JSON.parse(JSON.stringify(legacy)) } as ProgressState
  for (const level of LEVELS)
    for (const id of new Set([
      ...Object.keys(state.vKnown[level]),
      ...Object.keys(state.vLearning[level]),
    ])) {
      const ref = { level, kind: 'vocab' as const, id }
      state.schedules[itemKey(ref)] = {
        ref,
        stage: 0,
        dueOn: today,
        lastScheduledOn: '',
        lastResult: null,
      }
    }
  return state
}
