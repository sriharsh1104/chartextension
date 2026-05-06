import { DataFetcher, Timeframe } from './DataFetcher';
import { PatternAnalyzer, PatternResult } from './PatternAnalyzer';
import { VolatilityAnalyzer, VolatilityReport } from './VolatilityAnalyzer';

export type SignalType = 'BUY' | 'SELL' | 'SHORT' | 'COVER' | 'HOLD';

export type Signal = {
  type: SignalType;
  symbol: string;
  timestamp: number;
  reason: string;
  timeframeMatches: Partial<Record<Timeframe, PatternResult[]>>;
  confidence: number; // 0-100
  entryPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  volatility: VolatilityReport;
};

export class SignalGenerator {
  static async generateSignalForSymbol(symbol: string): Promise<Signal> {
    const timeframes: Timeframe[] = ['1m', '3m', '5m', '15m', '1h'];
    const timeframeMatches: Partial<Record<Timeframe, PatternResult[]>> = {};

    let bullishScore = 0;
    let bearishScore = 0;
    let totalPatterns = 0;
    let latestPrice = 0;
    let klines1m: any[] = [];

    for (const tf of timeframes) {
      const klines = await DataFetcher.fetchKlines(symbol, tf, 50);
      if (tf === '1m') {
        klines1m = klines;
        if (klines.length > 0) latestPrice = klines[klines.length - 1].close;
      }

      const patterns = PatternAnalyzer.analyzeKlines(klines);
      timeframeMatches[tf] = patterns;

      patterns.forEach(p => {
        totalPatterns++;
        const weight = tf === '1h' ? 2 : tf === '15m' ? 1.5 : 1;
        if (p.type === 'BULLISH') bullishScore += p.confidence * weight;
        if (p.type === 'BEARISH') bearishScore += p.confidence * weight;
      });
    }

    // ─── Volatility Analysis ──────────────────────────────────
    const volatility = VolatilityAnalyzer.analyze(klines1m, latestPrice);

    // ─── Signal Logic ─────────────────────────────────────────
    let type: SignalType = 'HOLD';
    let confidence = 0;
    let reason = 'Market is ranging, no clear scalping opportunity.';

    if (bullishScore > bearishScore * 1.5 && bullishScore > 100) {
      type = 'BUY';
      confidence = Math.min(100, (bullishScore / 300) * 100);
      reason = 'Strong Bullish alignment across timeframes. Good entry for Long Scalp.';
    } else if (bearishScore > bullishScore * 1.5 && bearishScore > 100) {
      type = 'SHORT';
      confidence = Math.min(100, (bearishScore / 300) * 100);
      reason = 'Strong Bearish alignment. Good entry for Short Scalp.';
    } else if (bullishScore > 80 && bearishScore > 80) {
      reason = 'Conflicting signals across timeframes. Wait for clearer trend.';
    }

    // ─── Suppress signal if market is dead/trap ───────────────
    if (volatility.isTrap && (type === 'BUY' || type === 'SHORT')) {
      // Downgrade confidence heavily when volatility is low
      confidence = Math.round(confidence * 0.4);
    }

    // ─── TP/SL — ATR-based (dynamic) ─────────────────────────
    let entryPrice: number | undefined;
    let takeProfit: number | undefined;
    let stopLoss: number | undefined;

    if ((type === 'BUY' || type === 'SHORT') && latestPrice > 0) {
      const atrValue = volatility.atr > 0 ? volatility.atr : latestPrice * 0.001;
      entryPrice = latestPrice;

      if (type === 'BUY') {
        takeProfit = latestPrice + atrValue * 2.0; // 2x ATR profit
        stopLoss   = latestPrice - atrValue * 1.0; // 1x ATR stop (1:2 RR)
      } else {
        takeProfit = latestPrice - atrValue * 2.0;
        stopLoss   = latestPrice + atrValue * 1.0;
      }
    }

    return {
      type,
      symbol,
      timestamp: Date.now(),
      reason,
      timeframeMatches,
      confidence: Math.round(confidence),
      entryPrice,
      takeProfit,
      stopLoss,
      volatility,
    };
  }
}
