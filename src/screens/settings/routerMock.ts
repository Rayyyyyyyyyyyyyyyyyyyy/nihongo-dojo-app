// jest.mock('expo-router', () => require('./routerMock'))：畫面只用到 Stack.Screen、useRouter、useLocalSearchParams。
export const push = jest.fn()
export const back = jest.fn()
export let params: Record<string, string> = {}
export const setParams = (p: Record<string, string>) => (params = p)
export const Stack = { Screen: () => null }
export const useRouter = () => ({ push, back })
export const useLocalSearchParams = () => params
