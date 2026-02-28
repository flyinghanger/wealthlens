import { calculate24hChangeValue } from './market-change.util';

describe('calculate24hChangeValue', () => {
  it('returns 0 when current value is invalid', () => {
    expect(calculate24hChangeValue(0, 5)).toBe(0);
    expect(calculate24hChangeValue(Number.NaN, 5)).toBe(0);
  });

  it('returns 0 when percent is invalid', () => {
    expect(calculate24hChangeValue(1000, 0)).toBe(0);
    expect(calculate24hChangeValue(1000, Number.NaN)).toBe(0);
  });

  it('calculates gain using previous-close formula', () => {
    const delta = calculate24hChangeValue(4598.88, 9.94);
    expect(delta).toBeCloseTo(415.80, 2);
  });

  it('calculates loss using previous-close formula', () => {
    const delta = calculate24hChangeValue(9162.34, -0.72);
    expect(delta).toBeCloseTo(-66.45, 2);
  });
});
