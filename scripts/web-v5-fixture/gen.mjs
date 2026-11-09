// Regenerates src/domain/progress/__fixtures__/web-v5.json with NHK-N3-1's real encoder.
// Usage: TZ=Asia/Taipei node scripts/web-v5-fixture/gen.mjs /path/to/NHK-N3-1 > src/domain/progress/__fixtures__/web-v5.json
// Needs Node >= 22.18 (built-in TypeScript stripping); hook.mjs adds the '.ts' extension Vite omits.
import { register } from 'node:module'
import { execSync } from 'node:child_process'
register('./hook.mjs', import.meta.url)
const root = process.argv[2]
const D = `${root}/src/domain`
const commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
const { defaultState, encodeCode } = await import(`${D}/progress/state.ts`)
const { recordResult, completeArticle } = await import(`${D}/learning/reducer.ts`)
const { generateGroup, refsFor } = await import(`${D}/learning/plans.ts`)
const { dayKey } = await import(`${D}/learning/types.ts`)
const at = (d) => () => new Date(`${d}T12:00:00`)
let s = defaultState()
s.level = 'n3'
const rec = (attemptId, ref, mode, correct, d) =>
  (s = recordResult(s, { attemptId, ref, mode, correct }, at(d)))
rec('v1', { level: 'n3', kind: 'vocab', id: '把握' }, 'flashcard', true, '2026-10-14')
rec('v2', { level: 'n3', kind: 'vocab', id: '曖昧' }, 'flashcard', false, '2026-10-15')
rec('v3', { level: 'n5', kind: 'vocab', id: '水' }, 'pronunciation', true, '2026-10-15')
rec('g1', { level: 'n3', kind: 'grammar', id: 'g-n3-005' }, 'grammar', true, '2026-10-16')
rec('g2', { level: 'n3', kind: 'grammar', id: 'g-n3-021' }, 'grammar', false, '2026-10-16')
rec('l1', { level: 'n3', kind: 'listening', id: 'l1' }, 'listening', true, '2026-10-16')
rec('gone', { level: 'n2', kind: 'grammar', id: 'g-n2-999' }, 'grammar', true, '2026-10-16')
const qs = ['rq-0001', 'rq-0002']
const rids = qs.map((q) => JSON.stringify(['art', q]))
qs.forEach((q, i) => rec(rids[i], { level: 'n3', kind: 'reading', id: q, articleId: 'r1' }, 'reading', true, '2026-10-16'))
s = completeArticle(s, { attemptId: 'art', level: 'n3', articleId: 'r1', questionIds: qs, resultIds: rids }, at('2026-10-16'))
const items = [{ w: '把握', r: 'はあく', zh: '', en: 'grasp' }, { w: '曖昧', r: 'あいまい', zh: '', en: 'vague' }]
s.plans[dayKey('2026-10-16', 'n3')] = {
  date: '2026-10-16', level: 'n3', branch: 'reading', started: true,
  groups: { vocab: generateGroup(s, refsFor('vocab', 'n3', items), 'vocab', '2026-10-16') },
}
const code = encodeCode(s)
process.stdout.write(JSON.stringify({ generator: `NHK-N3-1 ${commit} src/domain/progress/state.ts encodeCode`, tz: process.env.TZ, code, state: s }, null, 2) + '\n')
