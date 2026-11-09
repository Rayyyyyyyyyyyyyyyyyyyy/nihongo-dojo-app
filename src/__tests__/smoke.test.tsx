import { render, screen } from '@testing-library/react-native';
import Dojo from '../app/(tabs)/index';

test('道場分頁可渲染', async () => {
  await render(<Dojo />);
  expect(screen.getByText('道場')).toBeTruthy();
});
