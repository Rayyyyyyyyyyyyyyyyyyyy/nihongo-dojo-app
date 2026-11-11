// 道場意象的基本圖形（Belt／Seal／ChestIcon）與其套用：段位帶、結果頁蓋印、桐箱、收集冊印章分頁。
import { render } from '@testing-library/react-native'
import { fireEvent, screen } from 'expo-router/testing-library'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { AppProvider } from '../../state/AppProvider'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { Belt, ChestIcon, Seal } from '../../ui'
import { makeServices, readyDoc, renderApp } from '../../test/harness'
import { Result, type SessionLog } from '../session/Result'
import { fixtureBank } from '../../test/fixtures'
import { tokens } from '../../theme/tokens'

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>

afterEach(() => jest.restoreAllMocks())

describe('Belt', () => {
  test('依段位上色並帶段位名標籤；黑帶有朱線', async () => {
    await render(wrap(<><Belt rank={3} /><Belt rank={9} /></>))
    expect(flat(screen.getAllByTestId('belt-tail')[0])).toMatchObject({ backgroundColor: tokens.color.belt.orange })
    expect(screen.getByLabelText('二段的帶')).toBeOnTheScreen()
    expect(screen.getAllByTestId('belt-stripe')).toHaveLength(2)
  })
  test('結構：填色帶身（白帶也不是透明）、中央結、兩條帶尾', async () => {
    await render(wrap(<Belt rank={1} />))
    expect(flat(screen.getByLabelText('白帶的帶')).width).toBe(160)
    expect(screen.getByTestId('belt-knot')).toBeOnTheScreen()
    expect(screen.getAllByTestId('belt-tail')).toHaveLength(2)
    expect(flat(screen.getAllByTestId('belt-tail')[0]).backgroundColor).toBe(tokens.color.belt.white)
  })
})

describe('ChestIcon', () => {
  test('關／開兩態有不同的標籤', async () => {
    await render(wrap(<><ChestIcon /><ChestIcon open /></>))
    expect(screen.getByLabelText('桐箱')).toBeOnTheScreen()
    expect(screen.getByLabelText('打開的桐箱')).toBeOnTheScreen()
  })
  test('上鎖態：標籤讀出還沒解鎖與剩餘題數，綁著紐、沒有鎖', async () => {
    await render(wrap(<ChestIcon locked remaining={5} />))
    expect(screen.getByLabelText('桐箱，還沒解鎖，再 5 題')).toBeOnTheScreen()
    expect(screen.getByTestId('chest-cord')).toBeOnTheScreen()
    expect(screen.queryByTestId('chest-lock')).not.toBeOnTheScreen()
  })
  test('上鎖態沒有題數或為 0 時標籤不寫「再 N 題」；decorative 時隱藏', async () => {
    await render(wrap(<><ChestIcon locked /><ChestIcon locked remaining={0} /></>))
    expect(screen.getAllByLabelText('桐箱，還沒解鎖')).toHaveLength(2)
    await render(wrap(<ChestIcon locked remaining={3} decorative />))
    expect(screen.queryByLabelText('桐箱，還沒解鎖，再 3 題')).not.toBeOnTheScreen()
  })
  test('關著時用朱色紐綁、蓋頂打結；打開時紐鬆開垂下', async () => {
    await render(wrap(<ChestIcon />))
    expect(flat(screen.getByTestId('chest-cord')).backgroundColor).toBe(tokens.color.light.kiriCord)
    expect(screen.getByTestId('chest-knot')).toBeOnTheScreen()
    await render(wrap(<ChestIcon open />))
    expect(screen.getByTestId('chest-cord-loose')).toBeOnTheScreen()
  })
  test('減少動態：開啟時蓋子直接在打開位置', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    await render(wrap(<ChestIcon open />))
    expect(flat(screen.getByTestId('chest-lid')).transform).toEqual([{ rotate: '-28deg' }])
  })
})

describe('Seal 大印', () => {
  test('大尺寸有內框', async () => {
    await render(wrap(<><Seal text="稽古" size={120} label="大印" /><Seal text="1" label="小印" /></>))
    expect(screen.getAllByTestId('seal-inner')).toHaveLength(1)
  })
})

describe('Result 結果頁', () => {
  const log: SessionLog = { answers: [{ key: 'k', correct: true, xp: 10 }], goalCompleted: true, ceremony: null }
  const Probe = () => <Result log={log} bank={fixtureBank('n5')} today="2026-11-09" src="today" />
  const open = async () => {
    const s = makeServices({ doc: readyDoc() })
    await s.store.load()
    await render(wrap(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><AppProvider services={s.services}><Probe /></AppProvider></SafeAreaProvider>))
    return s
  }
  test('今日完成時可「先回道場」不蓋印離開', async () => {
    await open()
    expect(screen.getByRole('button', { name: '先回道場' })).toBeOnTheScreen()
  })
  test('蓋印按鈕文案與說明；輕點給「按住不放」提示、不蓋印；長按後出現大印', async () => {
    const s = await open()
    expect(screen.getByText('按住這裡蓋印')).toBeOnTheScreen()
    const btn = screen.getByRole('button', { name: '蓋下今天的印' })
    await fireEvent.press(btn)
    expect(screen.getByText('按住不放才會蓋下')).toBeOnTheScreen()
    expect(s.hapticsEngine.selectionAsync).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '開寶箱' })).not.toBeOnTheScreen()
    await fireEvent(btn, 'longPress')
    expect(screen.getByLabelText('今天的修行印已蓋下')).toBeOnTheScreen()
    expect(flat(screen.getByLabelText('今天的修行印已蓋下')).minWidth).toBe(120)
    expect(screen.getByRole('button', { name: '開寶箱' })).toBeOnTheScreen()
  })
  test('首屏：今日修行完成標題與總 XP 在分項明細之前', async () => {
    await open()
    const order = screen.toJSON() ? JSON.stringify(screen.toJSON()) : ''
    expect(order.indexOf('今日修行完成')).toBeLessThan(order.indexOf('首次答對'))
    expect(order.indexOf('+10 XP')).toBeLessThan(order.indexOf('首次答對'))
  })
})

describe('套用', () => {
  test('道場段位卡與我的頁顯示段位帶', async () => {
    await renderApp(makeServices({ doc: readyDoc() }))
    expect(await screen.findByLabelText('白帶的帶')).toBeOnTheScreen()
  })
  test('我的頁顯示段位帶', async () => {
    await renderApp(makeServices({ doc: readyDoc() }), '/me', 'me')
    expect(await screen.findByLabelText('白帶的帶')).toBeOnTheScreen()
  })
  test('桐箱畫面用 ChestIcon，開箱後變開啟', async () => {
    const s = makeServices({ doc: readyDoc((d) => ({ ...d, rewards: { ...d.rewards, goalCompletedDates: ['2026-11-09'] } })) })
    await renderApp(s, '/chest')
    expect(await screen.findByLabelText('桐箱')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '打開桐箱' }))
    expect(await screen.findByLabelText('打開的桐箱')).toBeOnTheScreen()
  })
})

describe('收集冊印章分頁', () => {
  const owned = (d: ReturnType<typeof readyDoc>) => ({
    ...d,
    rewards: { ...d.rewards, chest: { ...d.rewards.chest, ownedCosmetics: ['stamp-hatsugeiko', 'stamp-sakura'] } },
  })
  test('空狀態說明怎麼取得；全部是空心「未取得」', async () => {
    await renderApp(makeServices({ doc: readyDoc() }), '/collection', 'collection')
    await fireEvent.press(await screen.findByRole('button', { name: '印章' }))
    expect(await screen.findByText(/開桐箱/)).toBeOnTheScreen()
    expect(screen.getAllByText('未取得')).toHaveLength(13)
  })
  test('已取得的印用實心、其餘空心', async () => {
    await renderApp(makeServices({ doc: readyDoc(owned) }), '/collection', 'collection')
    await fireEvent.press(await screen.findByRole('button', { name: '印章' }))
    expect(await screen.findByLabelText('桜印，已取得')).toBeOnTheScreen()
    expect(screen.getByLabelText('富士印，未取得')).toBeOnTheScreen()
    expect(screen.getAllByText('未取得')).toHaveLength(11)
    expect(screen.queryByText(/開桐箱/)).not.toBeOnTheScreen()
  })
})
