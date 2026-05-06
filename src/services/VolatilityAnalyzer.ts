import { Kline } from './DataFetcher';

export type VolatilityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'DEAD';

export type VolatilityReport = {
  level: VolatilityLevel;
  atr: number;          // Absolute ATR value
  atrPercent: number;   // ATR as % of price (normalized)
  rangePercent: number; // Last candle range as % of price
  volumeRatio: number;  // Current vol vs avg vol (1.0 = normal)
  isTrap: boolean;      // True when signal exists but vol is too low = likely trap
  warning: string;      // Human-readable message
  emoji: string;
};

export class VolatilityAnalyzer {
  /**
   * Calculate ATR (Average True Range) - standard 14-period
   */
  static calcATR(klines: Kline[], period = 14): number {
    if (klines.length < period + 1) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < klines.length; i++) {
      const hl = klines[i].high - klines[i].low;
      const hc = Math.abs(klines[i].high - klines[i - 1].close);
      const lc = Math.abs(klines[i].low - klines[i - 1].close);
      trueRanges.push(Math.max(hl, hc, lc));
    }

    // Wilder's smoothing (RMA)
    const recent = trueRanges.slice(-period * 2);
    let atr = recent.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < recent.length; i++) {
      atr = (atr * (period - 1) + recent[i]) / period;
    }
    return atr;
  }

  /**
   * Compare recent ATR vs historical ATR to gauge current heat
   */
  static analyze(klines1m: Kline[], currentPrice: number): VolatilityReport {
    if (klines1m.length < 20) {
      return {
        level: 'DEAD',
        atr: 0,
        atrPercent: 0,
        rangePercent: 0,
        volumeRatio: 0,
        isTrap: true,
        warning: 'Not enough data to assess volatility.',
        emoji: '⚪',
      };
    }

    const atr = this.calcATR(klines1m, 14);
    const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;

    // Last candle range
    const lastCandle = klines1m[klines1m.length - 1];
    const rangePercent = currentPrice > 0
      ? ((lastCandle.high - lastCandle.low) / currentPrice) * 100
      : 0;

    // Volume ratio: last 5 candles avg vs last 20 candles avg
    const volumes = klines1m.map(k => k.volume);
    const recentVolAvg = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
    const baseVolAvg = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    const volumeRatio = baseVolAvg > 0 ? recentVolAvg / baseVolAvg : 1;

    // Determine level based on ATR% of price
    // Gold (XAUUSD) moves ~0.05–0.3% per minute normally
    // Oil moves ~0.05–0.2%
    // Forex moves ~0.003–0.05%
    let level: VolatilityLevel;
    let warning: string;
    let emoji: string;
    let isTrap: boolean;

    if (atrPercent >= 0.08 && volumeRatio >= 0.8) {
      level = 'HIGH';
      emoji = '🔥';
      isTrap = false;
      warning = 'High volatility — strong movement detected. Good for scalping!';
    } else if (atrPercent >= 0.04 && volumeRatio >= 0.6) {
      level = 'MEDIUM';
      emoji = '⚡';
      isTrap = false;
      warning = 'Normal volatility. Signals are reliable, manage risk.';
    } else if (atrPercent >= 0.02) {
      level = 'LOW';
      emoji = '😴';
      isTrap = true;
      warning = 'Low volatility — market is slow. Risk of false signals & traps! Wait.';
    } else {
      level = 'DEAD';
      emoji = '🚫';
      isTrap = true;
      warning = 'DEAD market — near zero movement. Do NOT trade! High trap risk.';
    }

    // Override: Low volume even with decent ATR = pump/dump trap risk
    if (volumeRatio < 0.4 && level !== 'DEAD') {
      level = 'LOW';
      emoji = '⚠️';
      isTrap = true;
      warning = 'Low volume warning! Price moving without buyers/sellers — could be a trap. Avoid entry.';
    }

    return { level, atr, atrPercent, rangePercent, volumeRatio, isTrap, warning, emoji };
  }
}
