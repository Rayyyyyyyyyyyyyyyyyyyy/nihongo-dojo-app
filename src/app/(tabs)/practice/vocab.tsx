import { Stack } from 'expo-router';
import VocabLesson from '../../../screens/practice/VocabLesson';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: '單字課', headerLargeTitle: false }} />
      <VocabLesson />
    </>
  );
}
