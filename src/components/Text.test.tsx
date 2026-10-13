import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Text, TextInput } from './Text';

jest.mock('@/platform/font', () => ({ fontFamily: 'TestFont' }));

describe('Text', () => {
  it('applies the platform font family and keeps the caller style', async () => {
    await render(<Text style={{ fontSize: 20 }}>Cool down</Text>);
    const style = StyleSheet.flatten(screen.getByText('Cool down').props.style);
    expect(style).toMatchObject({ fontFamily: 'TestFont', fontSize: 20 });
  });

  it('lets the caller override the font family', async () => {
    await render(<Text style={{ fontFamily: 'monospace' }}>0:00</Text>);
    expect(StyleSheet.flatten(screen.getByText('0:00').props.style).fontFamily).toBe('monospace');
  });
});

describe('TextInput', () => {
  it('applies the platform font family', async () => {
    await render(<TextInput testID="input" style={{ fontSize: 18 }} />);
    const style = StyleSheet.flatten(screen.getByTestId('input').props.style);
    expect(style).toMatchObject({ fontFamily: 'TestFont', fontSize: 18 });
  });
});
