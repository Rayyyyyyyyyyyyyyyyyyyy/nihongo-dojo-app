import { Stack } from 'expo-router';
import Review from '../../../screens/review/Review';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: '複習', headerLargeTitle: false }} />
      <Review />
    </>
  );
}
