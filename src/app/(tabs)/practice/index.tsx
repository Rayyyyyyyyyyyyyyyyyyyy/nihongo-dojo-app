import { Stack } from 'expo-router';
import Practice from '../../../screens/practice/Practice';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: '修行' }} />
      <Practice />
    </>
  );
}
