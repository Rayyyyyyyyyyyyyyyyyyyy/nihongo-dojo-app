// C8 第 2 輪 N1／N2：課表以外的入口（深連結、複習）也套用 N3–N1 購買限制。
import { screen } from 'expo-router/testing-library'
import { itemKey, type StudyItemRef } from '../../domain/learning/types'
import { fixtureBank, fixtureManifest } from '../../test/fixtures'
import { makeServices, readyDoc, renderApp } from '../../test/harness'
import { reviewQueue } from '../session/queue'

const n3 = (owned: boolean) =>
  readyDoc((d) => ({ ...d, learning: { ...d.learning, level: 'n3' }, meta: { ...d.meta, firstOpenDate: '2026-11-01' }, entitlement: { ...d.entitlement, owned } }))

test('N1：未購以深連結開 N3 第 2 課不出題', async () => {
  await renderApp(makeServices({ doc: n3(false) }), '/session?src=lesson&kind=grammar&lesson=2')
  expect(await screen.findByText('沒有可以練習的題目')).toBeOnTheScreen()
})

test('N1：已購以深連結開 N3 第 2 課照常出題', async () => {
  await renderApp(makeServices({ doc: n3(true) }), '/session?src=lesson&kind=grammar&lesson=2')
  expect(await screen.findByRole('header')).toBeOnTheScreen()
  expect(screen.queryByText('沒有可以練習的題目')).toBeNull()
})

test('N2：未購時第 2 課的錯題不進複習佇列，列為完整版內容並保留紀錄；購買後可複習', () => {
  const bank = fixtureBank('n3')
  const id = fixtureManifest.levels.n3.lessons.grammar[1].itemIds[0]
  const ref: StudyItemRef = { kind: 'grammar', level: 'n3', id }
  const withMistake = (owned: boolean) => {
    const d = n3(owned)
    const m = { ref, pending: true, wrongCount: 1, lastResultAt: '2026-11-09T09:00:00.000Z' }
    return { ...d, learning: { ...d.learning, mistakes: { ...d.learning.mistakes, [itemKey(ref)]: m as never } } }
  }
  const locked = reviewQueue(withMistake(false), bank, '2026-11-10', fixtureManifest)
  expect(locked.items).toEqual([])
  expect(locked.locked).toEqual([ref])
  const owned = reviewQueue(withMistake(true), bank, '2026-11-10', fixtureManifest)
  expect(owned.items).toHaveLength(1)
  expect(owned.locked).toEqual([])
})
