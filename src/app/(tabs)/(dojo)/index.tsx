import { Stack } from 'expo-router';
import Dojo from '../../../screens/dojo/Dojo';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: '道場' }} />
      <Dojo />
    </>
  );
}
