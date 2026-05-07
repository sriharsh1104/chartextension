import { EMA, RSI, MACD, Stochastic } from 'technicalindicators';
import { Kline } from './DataFetcher';
import { PatternAnalyzer, PatternResult } from './PatternAnalyzer';

export interface IndicatorSnapshot {
  // ── Trend ────────────────────────────────────────────────
  ema9: number;
  ema21: number;
  ema50: number;
  emaTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';  // ema9 vs ema21
  priceVsEma50: 'ABOVE' | 'BELOW';

  // ── Momentum ─────────────────────────────────────────────
  rsi: number;
  rsiZone: 'OVERSOLD' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'OVERBOUGHT';

  macdHist: number;                               // > 0 = bullish momentum
  macdBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

  stochK: number;
  stochD: number;
  stochBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

  // ── Volume ───────────────────────────────────────────────
  volumeRatio: number;                            // lastVol / avg20Vol

  // ── Patterns (only high confidence ≥70) ──────────────────
  bullishPatterns: PatternResult[];
  bearishPatterns: PatternResult[];

  lastClose: number;
}

export class IndicatorEngine {
  /**
   * Compute a full snapshot of all indicators for a given kline array.
   * Returns null if insufficient data.
   */
  static compute(klines: Kline[]): IndicatorSnapshot | null {
    if (klines.length < 52) return null;

    const close  = klines.map(k => k.close);
    const high   = klines.map(k => k.high);
    const low    = klines.map(k => k.low);
    const volume = klines.map(k => k.volume);
    const lastClose = close.at(-1)!;

    // ── EMAs ─────────────────────────────────────────────────────────────────
    const ema9  = EMA.calculate({ period: 9,  values: close }).at(-1) ?? lastClose;
    const ema21 = EMA.calculate({ period: 21, values: close }).at(-1) ?? lastClose;
    const ema50 = EMA.calculate({ period: 50, values: close }).at(-1) ?? lastClose;

    let emaTrend: IndicatorSnapshot['emaTrend'] = 'NEUTRAL';
    // Require 0.02% separation to avoid noise-flips
    if (ema9 > ema21 * 1.0002) emaTrend = 'BULLISH';
    else if (ema9 < ema21 * 0.9998) emaTrend = 'BEARISH';

    // ── RSI ───────────────────────────────────────────────────────────────────
    const rsi = RSI.calculate({ period: 14, values: close }).at(-1) ?? 50;
    let rsiZone: IndicatorSnapshot['rsiZone'] = 'NEUTRAL';
    if      (rsi < 30) rsiZone = 'OVERSOLD';
    else if (rsi < 45) rsiZone = 'BEARISH';
    else if (rsi > 70) rsiZone = 'OVERBOUGHT';
    else if (rsi > 55) rsiZone = 'BULLISH';

    // ── MACD ──────────────────────────────────────────────────────────────────
    let macdHist = 0;
    let macdBias: IndicatorSnapshot['macdBias'] = 'NEUTRAL';
    try {
      const macdArr = MACD.calculate({
        values: close, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
        SimpleMAOscillator: false, SimpleMASignal: false,
      });
      const cur  = macdArr.at(-1);
      const prev = macdArr.at(-2);
      if (cur?.MACD != null && cur?.signal != null) {
        macdHist = cur.MACD - cur.signal;
        // Bias: histogram direction + crossover
        if (macdHist > 0) macdBias = 'BULLISH';
        else if (macdHist < 0) macdBias = 'BEARISH';
        // Crossover upgrades confidence
        if (prev?.MACD != null && prev?.signal != null) {
          const prevHist = prev.MACD - prev.signal;
          if (prevHist < 0 && macdHist > 0) macdBias = 'BULLISH'; // fresh bull cross
          if (prevHist > 0 && macdHist < 0) macdBias = 'BEARISH'; // fresh bear cross
        }
      }
    } catch (_) {}

    // ── Stochastic ───────────────────────────────────────────────────────────
    let stochK = 50, stochD = 50;
    let stochBias: IndicatorSnapshot['stochBias'] = 'NEUTRAL';
    try {
      const stochArr = Stochastic.calculate({ high, low, close, period: 14, signalPeriod: 3 });
      const prev = stochArr.at(-2);
      const cur  = stochArr.at(-1);
      if (cur) {
        stochK = cur.k; stochD = cur.d;
        if (prev) {
          // Crossover in oversold zone
          if (prev.k < prev.d && cur.k > cur.d && cur.k < 35) stochBias = 'BULLISH';
          // Crossover in overbought zone
          else if (prev.k > prev.d && cur.k < cur.d && cur.k > 65) stochBias = 'BEARISH';
          // General directional bias
          else if (cur.k > 50 && cur.k > cur.d) stochBias = 'BULLISH';
          else if (cur.k < 50 && cur.k < cur.d) stochBias = 'BEARISH';
        }
      }
    } catch (_) {}

    // ── Volume Ratio ─────────────────────────────────────────────────────────
    const avgVol = volume.slice(-21, -1).reduce((s, v) => s + v, 0) / 20;
    const lastVol = volume.at(-1) ?? 0;
    const volumeRatio = avgVol > 0 ? lastVol / avgVol : 1.0;

    // ── Patterns (high-confidence only ≥70) ──────────────────────────────────
    const allPatterns = PatternAnalyzer.analyzeKlines(klines);
    const bullishPatterns = allPatterns.filter(p => p.type === 'BULLISH' && p.confidence >= 70);
    const bearishPatterns = allPatterns.filter(p => p.type === 'BEARISH' && p.confidence >= 70);

    return {
      ema9, ema21, ema50, emaTrend,
      priceVsEma50: lastClose > ema50 ? 'ABOVE' : 'BELOW',
      rsi, rsiZone,
      macdHist, macdBias,
      stochK, stochD, stochBias,
      volumeRatio,
      bullishPatterns, bearishPatterns,
      lastClose,
    };
  }
}
