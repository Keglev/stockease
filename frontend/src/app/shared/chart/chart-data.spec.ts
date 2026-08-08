import { ChartSlice, topNWithRemainder } from './chart-data';

const OTHER = 'Other';

/* Builds n slices with descending values, so the ranking order is known up front. */
function slices(n: number, from = 100): ChartSlice[] {
  return Array.from({ length: n }, (_, index) => ({
    name: `P${index}`,
    value: from - index
  }));
}

describe('topNWithRemainder', () => {
  it('topNWithRemainder_fewerThanTenSlices_returnsAllWithoutBucket', () => {
    const result = topNWithRemainder(slices(4), OTHER);

    expect(result.length).toBe(4);
    expect(result.map((slice) => slice.name)).not.toContain(OTHER);
  });

  it('topNWithRemainder_exactlyTenSlices_returnsAllWithoutBucket', () => {
    const result = topNWithRemainder(slices(10), OTHER);

    // A bucket standing for nothing would hide a name for no aggregation at all.
    expect(result.length).toBe(10);
    expect(result.map((slice) => slice.name)).not.toContain(OTHER);
  });

  it('topNWithRemainder_elevenSlices_returnsTenPlusRemainderSum', () => {
    const result = topNWithRemainder(slices(11), OTHER);

    expect(result.length).toBe(11);
    expect(result[10]).toEqual({ name: OTHER, value: 90 });
  });

  it('topNWithRemainder_negativeValues_ranksByAbsoluteValue', () => {
    const input: ChartSlice[] = [
      { name: 'Small', value: 5 },
      { name: 'BigLoss', value: -80 },
      { name: 'Medium', value: 20 }
    ];

    // A large loss is as chart-worthy as a large gain, so magnitude decides the order.
    expect(topNWithRemainder(input, OTHER).map((slice) => slice.name)).toEqual([
      'BigLoss',
      'Medium',
      'Small'
    ]);
  });

  it('topNWithRemainder_remainder_sumsNegativeAndPositiveRest', () => {
    const input: ChartSlice[] = [
      ...slices(10, 1000),
      { name: 'Tail+', value: 30 },
      { name: 'Tail-', value: -50 }
    ];

    // The bucket is the plain sum, so it may come out negative; that is the honest figure.
    expect(topNWithRemainder(input, OTHER)[10]).toEqual({ name: OTHER, value: -20 });
  });
});
