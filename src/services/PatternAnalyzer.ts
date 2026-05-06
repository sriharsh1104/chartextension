import { 
  bullishengulfingpattern, 
  bearishengulfingpattern, 
  hammerpattern, 
  SMA,
  RSI
} from 'technicalindicators';
import { Kline } from './DataFetcher';

export type PatternResult = {
  name: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; // 0 - 100
};

export class PatternAnalyzer {
  static analyzeKlines(klines: Kline[]): PatternResult[] {
    if (klines.length < 14) return [];

    const open = klines.map(k => k.open);
    const high = klines.map(k => k.high);
    const low = klines.map(k => k.low);
    const close = klines.map(k => k.close);
    
    const results: PatternResult[] = [];

    // Candlestick Patterns (Using last 5 candles)
    const recentInput = {
      open: open.slice(-5),
      high: high.slice(-5),
      low: low.slice(-5),
      close: close.slice(-5)
    };

    if (bullishengulfingpattern(recentInput)) {
      results.push({ name: 'Bullish Engulfing', type: 'BULLISH', confidence: 80 });
    }
    if (bearishengulfingpattern(recentInput)) {
      results.push({ name: 'Bearish Engulfing', type: 'BEARISH', confidence: 80 });
    }
    if (hammerpattern(recentInput)) {
      results.push({ name: 'Hammer', type: 'BULLISH', confidence: 60 });
    }

    // Trend Analysis (SMA 9 vs SMA 21)
    const sma9 = SMA.calculate({ period: 9, values: close });
    const sma21 = SMA.calculate({ period: 21, values: close });
    
    if (sma9.length > 0 && sma21.length > 0) {
      const lastSma9 = sma9[sma9.length - 1];
      const lastSma21 = sma21[sma21.length - 1];
      
      if (lastSma9 > lastSma21) {
        results.push({ name: 'Uptrend (SMA9 > SMA21)', type: 'BULLISH', confidence: 70 });
      } else if (lastSma9 < lastSma21) {
        results.push({ name: 'Downtrend (SMA9 < SMA21)', type: 'BEARISH', confidence: 70 });
      }
    }

    // RSI Analysis (Oversold / Overbought)
    const rsi = RSI.calculate({ period: 14, values: close });
    if (rsi.length > 0) {
      const lastRsi = rsi[rsi.length - 1];
      if (lastRsi < 30) {
        results.push({ name: `RSI Oversold (${lastRsi.toFixed(1)})`, type: 'BULLISH', confidence: 85 });
      } else if (lastRsi > 70) {
        results.push({ name: `RSI Overbought (${lastRsi.toFixed(1)})`, type: 'BEARISH', confidence: 85 });
      }
    }

    return results;
  }
}
