import { square } from './test-tests';

describe('square', () => {
  test('returns 4 given 2', () => {
    expect(square(2)).toBe(4);
  });
});