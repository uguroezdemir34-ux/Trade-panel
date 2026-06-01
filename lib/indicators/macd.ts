export interface MacdPoint {
  time: number;
  hist: number;
  macd: number;
  signal: number;
}

function emaValues(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result = new Array<number>(data.length);
  result[0] = data[0] ?? 0;
  for (let i = 1; i < data.length; i++) {
    result[i] = (data[i] ?? 0) * k + result[i - 1] * (1 - k);
  }
  return result;
}

export function macdSeries(
  closes: number[],
  times: number[],
  opts: { fast?: number; slow?: number; signal?: number } = {},
): MacdPoint[] {
  const { fast = 12, slow = 26, signal = 9 } = opts;
  if (closes.length < slow + signal) return [];

  const ema12 = emaValues(closes, fast);
  const ema26 = emaValues(closes, slow);

  // Collect MACD values starting at the slow-1 index
  const macdLine: number[] = [];
  const macdIndices: number[] = [];
  for (let i = slow - 1; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
    macdIndices.push(i);
  }

  if (macdLine.length < signal) return [];

  const signalLine = emaValues(macdLine, signal);

  const result: MacdPoint[] = [];
  for (let j = signal - 1; j < macdLine.length; j++) {
    const origIdx = macdIndices[j];
    const m = macdLine[j];
    const s = signalLine[j];
    result.push({
      time: times[origIdx],
      macd: m,
      signal: s,
      hist: m - s,
    });
  }
  return result;
}
