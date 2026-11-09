import web from './__fixtures__/web-v5.json'
import { importWebV5Code } from './importCode'
import { defaultState, encodeCode } from './state'

const envelope = (v: unknown) => btoa(encodeURIComponent(JSON.stringify(v)))
const legacy = () => {
  const { results, days, plans, mistakes, schedules, ...s } = defaultState()
  return s
}

it('imports a code produced by the web encoder exactly and re-encodes it byte for byte', () => {
  const state = importWebV5Code(web.code)
  expect(state).toEqual(web.state)
  expect(encodeCode(state)).toBe(web.code)
})

it('keeps records whose IDs are not in any bank', () => {
  expect(importWebV5Code(web.code).gDone.n2).toEqual(['g-n2-999'])
})

it('rejects v4 codes even when their state is valid', () => {
  expect(() => importWebV5Code(envelope({ version: 4, state: legacy() }))).toThrow(/v4/)
})

it.each([
  ['garbage', '這不是 base64!!!'],
  ['unknown version', envelope({ version: 6, state: web.state })],
  ['unknown envelope field', envelope({ version: 5, state: web.state, extra: 1 })],
  ['unknown state field', envelope({ version: 5, state: { ...web.state, extra: 1 } })],
])('rejects %s', (_name, code) => {
  expect(() => importWebV5Code(code)).toThrow()
})
