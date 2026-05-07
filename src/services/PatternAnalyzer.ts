import {
  bullishengulfingpattern,
  bearishengulfingpattern,
  hammerpattern,
  hangingman,
  shootingstar,
  morningstar,
  eveningstar,
  doji,
  bullishharami,
  bearishharami,
  piercingline,
  darkcloudcover,
  threewhitesoldiers,
  threeblackcrows,
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  Stochastic,
} from 'technicalindicators';
import { Kline } from './DataFetcher';

export type PatternResult = {
  name: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; // 0 – 100
  category: 'CANDLESTICK' | 'TREND' | 'MOMENTUM' | 'VOLATILITY';
};

export class PatternAnalyzer {
  static analyzeKlines(klines: Kline[]): PatternResult[] {
    if (klines.length < 20) return [];

    const open  = klines.map(k => k.open);
    const high  = klines.map(k => k.high);
    const low   = klines.map(k => k.low);
    const close = klines.map(k => k.close);
    const volume = klines.map(k => k.volume);

    const results: PatternResult[] = [];

    // ─────────────────────────────────────────────────────────────
    // 1. CANDLESTICK PATTERNS
    // ─────────────────────────────────────────────────────────────
    const inp5 = {
      open:  open.slice(-5),
      high:  high.slice(-5),
      low:   low.slice(-5),
      close: close.slice(-5),
    };
    const inp3 = {
      open:  open.slice(-3),
      high:  high.slice(-3),
      low:   low.slice(-3),
      close: close.slice(-3),
    };

    // Engulfing
    if (bullishengulfingpattern(inp5))
      results.push({ name: 'Bullish Engulfing', type: 'BULLISH', confidence: 80, category: 'CANDLESTICK' });
    if (bearishengulfingpattern(inp5))
      results.push({ name: 'Bearish Engulfing', type: 'BEARISH', confidence: 80, category: 'CANDLESTICK' });

    // Hammer / Hanging Man
    if (hammerpattern(inp5))
      results.push({ name: 'Hammer', type: 'BULLISH', confidence: 65, category: 'CANDLESTICK' });
    if (hangingman(inp5))
      results.push({ name: 'Hanging Man', type: 'BEARISH', confidence: 62, category: 'CANDLESTICK' });

    // Shooting Star / Inverted Hammer (same shape, different context)
    if (shootingstar(inp5))
      results.push({ name: 'Shooting Star', type: 'BEARISH', confidence: 72, category: 'CANDLESTICK' });

    // Morning Star / Evening Star (3-candle reversal)
    if (morningstar({ open: open.slice(-10), high: high.slice(-10), low: low.slice(-10), close: close.slice(-10) }))
      results.push({ name: 'Morning Star', type: 'BULLISH', confidence: 85, category: 'CANDLESTICK' });
    if (eveningstar({ open: open.slice(-10), high: high.slice(-10), low: low.slice(-10), close: close.slice(-10) }))
      results.push({ name: 'Evening Star', type: 'BEARISH', confidence: 85, category: 'CANDLESTICK' });

    // Doji (indecision)
    if (doji(inp3))
      results.push({ name: 'Doji (Indecision)', type: 'NEUTRAL', confidence: 50, category: 'CANDLESTICK' });

    // Harami (inside bar reversal)
    if (bullishharami(inp5))
      results.push({ name: 'Bullish Harami', type: 'BULLISH', confidence: 68, category: 'CANDLESTICK' });
    if (bearishharami(inp5))
      results.push({ name: 'Bearish Harami', type: 'BEARISH', confidence: 68, category: 'CANDLESTICK' });

    // Piercing Line / Dark Cloud Cover
    if (piercingline(inp5))
      results.push({ name: 'Piercing Line', type: 'BULLISH', confidence: 74, category: 'CANDLESTICK' });
    if (darkcloudcover({ open: open.slice(-5), high: high.slice(-5), low: low.slice(-5), close: close.slice(-5), penetration: 0.5 }))
      results.push({ name: 'Dark Cloud Cover', type: 'BEARISH', confidence: 74, category: 'CANDLESTICK' });

    // Three White Soldiers / Three Black Crows (strong continuation)
    if (threewhitesoldiers(inp5))
      results.push({ name: 'Three White Soldiers', type: 'BULLISH', confidence: 90, category: 'CANDLESTICK' });
    if (threeblackcrows(inp5))
      results.push({ name: 'Three Black Crows', type: 'BEARISH', confidence: 90, category: 'CANDLESTICK' });

    // Manual: Pinbar / Rejection Wick detection
    const lastCandle = { o: open.at(-1)!, h: high.at(-1)!, l: low.at(-1)!, c: close.at(-1)! };
    const body   = Math.abs(lastCandle.c - lastCandle.o);
    const range  = lastCandle.h - lastCandle.l;
    const upperW = lastCandle.h - Math.max(lastCandle.o, lastCandle.c);
    const lowerW = Math.min(lastCandle.o, lastCandle.c) - lastCandle.l;
    if (range > 0) {
      if (lowerW > body * 2.5 && lowerW > upperW * 2) {
        results.push({ name: 'Bullish Pin Bar', type: 'BULLISH', confidence: 78, category: 'CANDLESTICK' });
      }
      if (upperW > body * 2.5 && upperW > lowerW * 2) {
        results.push({ name: 'Bearish Pin Bar', type: 'BEARISH', confidence: 78, category: 'CANDLESTICK' });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. TREND INDICATORS
    // ─────────────────────────────────────────────────────────────

    // EMA 9 / 21 crossover
    const ema9  = EMA.calculate({ period: 9,  values: close });
    const ema21 = EMA.calculate({ period: 21, values: close });
    if (ema9.length >= 2 && ema21.length >= 2) {
      const e9  = ema9.at(-1)!;  const e9p  = ema9.at(-2)!;
      const e21 = ema21.at(-1)!; const e21p = ema21.at(-2)!;
      if (e9p <= e21p && e9 > e21)
        results.push({ name: 'EMA 9/21 Golden Cross', type: 'BULLISH', confidence: 82, category: 'TREND' });
      else if (e9p >= e21p && e9 < e21)
        results.push({ name: 'EMA 9/21 Death Cross', type: 'BEARISH', confidence: 82, category: 'TREND' });
      else if (e9 > e21)
        results.push({ name: 'Uptrend (EMA9 > EMA21)', type: 'BULLISH', confidence: 65, category: 'TREND' });
      else
        results.push({ name: 'Downtrend (EMA9 < EMA21)', type: 'BEARISH', confidence: 65, category: 'TREND' });
    }

    // EMA 50 — price above/below long-term trend
    const ema50 = EMA.calculate({ period: 50, values: close });
    const lastClose = close.at(-1)!;
    if (ema50.length > 0) {
      const e50 = ema50.at(-1)!;
      if (lastClose > e50 * 1.001)
        results.push({ name: 'Price Above EMA50', type: 'BULLISH', confidence: 60, category: 'TREND' });
      else if (lastClose < e50 * 0.999)
        results.push({ name: 'Price Below EMA50', type: 'BEARISH', confidence: 60, category: 'TREND' });
    }

    // SMA 9 / 21 (classic)
    const sma9  = SMA.calculate({ period: 9,  values: close });
    const sma21 = SMA.calculate({ period: 21, values: close });
    if (sma9.length > 0 && sma21.length > 0) {
      if (sma9.at(-1)! > sma21.at(-1)!)
        results.push({ name: 'SMA9 > SMA21 Bullish', type: 'BULLISH', confidence: 58, category: 'TREND' });
      else
        results.push({ name: 'SMA9 < SMA21 Bearish', type: 'BEARISH', confidence: 58, category: 'TREND' });
    }

    // Volume Spike detection (volume > 2× avg20)
    if (volume.length >= 20) {
      const avgVol20 = volume.slice(-20, -1).reduce((s, v) => s + v, 0) / 19;
      const lastVol  = volume.at(-1)!;
      if (lastVol > avgVol20 * 2) {
        const type = lastClose > open.at(-1)! ? 'BULLISH' : 'BEARISH';
        results.push({ name: `Volume Spike (${(lastVol / avgVol20).toFixed(1)}× avg)`, type, confidence: 75, category: 'TREND' });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. MOMENTUM INDICATORS
    // ─────────────────────────────────────────────────────────────

    // RSI
    const rsi = RSI.calculate({ period: 14, values: close });
    if (rsi.length > 0) {
      const r = rsi.at(-1)!;
      if (r < 25)
        results.push({ name: `RSI Extreme Oversold (${r.toFixed(1)})`, type: 'BULLISH', confidence: 90, category: 'MOMENTUM' });
      else if (r < 35)
        results.push({ name: `RSI Oversold (${r.toFixed(1)})`, type: 'BULLISH', confidence: 75, category: 'MOMENTUM' });
      else if (r > 75)
        results.push({ name: `RSI Extreme Overbought (${r.toFixed(1)})`, type: 'BEARISH', confidence: 90, category: 'MOMENTUM' });
      else if (r > 65)
        results.push({ name: `RSI Overbought (${r.toFixed(1)})`, type: 'BEARISH', confidence: 75, category: 'MOMENTUM' });
      else if (r > 50 && r <= 65)
        results.push({ name: `RSI Bullish Zone (${r.toFixed(1)})`, type: 'BULLISH', confidence: 52, category: 'MOMENTUM' });
      else if (r < 50 && r >= 35)
        results.push({ name: `RSI Bearish Zone (${r.toFixed(1)})`, type: 'BEARISH', confidence: 52, category: 'MOMENTUM' });
    }

    // MACD crossover
    try {
      const macdResult = MACD.calculate({
        values: close, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
        SimpleMAOscillator: false, SimpleMASignal: false,
      });
      if (macdResult.length >= 2) {
        const cur  = macdResult.at(-1)!;
        const prev = macdResult.at(-2)!;
        if (cur.MACD != null && cur.signal != null && prev.MACD != null && prev.signal != null) {
          if (prev.MACD <= prev.signal && cur.MACD > cur.signal)
            results.push({ name: 'MACD Bullish Crossover', type: 'BULLISH', confidence: 80, category: 'MOMENTUM' });
          else if (prev.MACD >= prev.signal && cur.MACD < cur.signal)
            results.push({ name: 'MACD Bearish Crossover', type: 'BEARISH', confidence: 80, category: 'MOMENTUM' });
          else if (cur.MACD! > 0)
            results.push({ name: 'MACD Positive (Bullish Bias)', type: 'BULLISH', confidence: 55, category: 'MOMENTUM' });
          else
            results.push({ name: 'MACD Negative (Bearish Bias)', type: 'BEARISH', confidence: 55, category: 'MOMENTUM' });
        }
      }
    } catch (_) {}

    // Stochastic %K / %D
    try {
      const stoch = Stochastic.calculate({
        high, low, close, period: 14, signalPeriod: 3,
      });
      if (stoch.length >= 2) {
        const cur  = stoch.at(-1)!;
        const prev = stoch.at(-2)!;
        if (cur.k < 20 && cur.d < 20)
          results.push({ name: `Stochastic Oversold (%K:${cur.k.toFixed(0)})`, type: 'BULLISH', confidence: 78, category: 'MOMENTUM' });
        else if (cur.k > 80 && cur.d > 80)
          results.push({ name: `Stochastic Overbought (%K:${cur.k.toFixed(0)})`, type: 'BEARISH', confidence: 78, category: 'MOMENTUM' });
        // Stoch bullish cross in oversold zone
        if (prev.k < prev.d && cur.k > cur.d && cur.k < 30)
          results.push({ name: 'Stochastic Bullish Cross (Oversold)', type: 'BULLISH', confidence: 85, category: 'MOMENTUM' });
        if (prev.k > prev.d && cur.k < cur.d && cur.k > 70)
          results.push({ name: 'Stochastic Bearish Cross (Overbought)', type: 'BEARISH', confidence: 85, category: 'MOMENTUM' });
      }
    } catch (_) {}

    // ─────────────────────────────────────────────────────────────
    // 4. VOLATILITY / STRUCTURE
    // ─────────────────────────────────────────────────────────────

    // Bollinger Band Squeeze / Breakout
    try {
      const bb = BollingerBands.calculate({ period: 20, values: close, stdDev: 2 });
      if (bb.length > 0) {
        const { upper, lower, middle } = bb.at(-1)!;
        const bandWidth = (upper - lower) / middle;
        if (bandWidth < 0.005)
          results.push({ name: 'BB Squeeze (Breakout Pending)', type: 'NEUTRAL', confidence: 60, category: 'VOLATILITY' });
        else if (lastClose > upper)
          results.push({ name: 'BB Upper Band Breakout', type: 'BEARISH', confidence: 72, category: 'VOLATILITY' });
        else if (lastClose < lower)
          results.push({ name: 'BB Lower Band Breakout', type: 'BULLISH', confidence: 72, category: 'VOLATILITY' });
        else if (lastClose > middle && lastClose < upper)
          results.push({ name: 'Price in BB Upper Half', type: 'BULLISH', confidence: 48, category: 'VOLATILITY' });
        else if (lastClose < middle && lastClose > lower)
          results.push({ name: 'Price in BB Lower Half', type: 'BEARISH', confidence: 48, category: 'VOLATILITY' });
      }
    } catch (_) {}

    // Support/Resistance: Higher High & Higher Low (last 10 closes)
    const recent10 = close.slice(-10);
    const localHigh = Math.max(...recent10.slice(0, 5));
    const localLow  = Math.min(...recent10.slice(0, 5));
    const currHigh  = Math.max(...recent10.slice(5));
    const currLow   = Math.min(...recent10.slice(5));
    if (currHigh > localHigh && currLow > localLow)
      results.push({ name: 'Higher High + Higher Low (Uptrend Structure)', type: 'BULLISH', confidence: 70, category: 'TREND' });
    else if (currHigh < localHigh && currLow < localLow)
      results.push({ name: 'Lower High + Lower Low (Downtrend Structure)', type: 'BEARISH', confidence: 70, category: 'TREND' });

    return results;
  }
}
