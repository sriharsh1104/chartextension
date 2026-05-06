import { DataFetcher, Timeframe } from './DataFetcher';
import { PatternAnalyzer, PatternResult } from './PatternAnalyzer';

export type SignalType = 'BUY' | 'SELL' | 'SHORT' | 'COVER' | 'HOLD';

export type Signal = {
  type: SignalType;
  symbol: string;
  timestamp: number;
  reason: string;
  timeframeMatches: Partial<Record<Timeframe, PatternResult[]>>;
  confidence: number; // 0-100
};

export class SignalGenerator {
  static async generateSignalForSymbol(symbol: string): Promise<Signal> {
    const timeframes: Timeframe[] = ['1m', '3m', '5m', '15m', '1h'];
    const timeframeMatches: Partial<Record<Timeframe, PatternResult[]>> = {};
    
    let bullishScore = 0;
    let bearishScore = 0;
    let totalPatterns = 0;

    for (const tf of timeframes) {
      const klines = await DataFetcher.fetchKlines(symbol, tf, 50);
      const patterns = PatternAnalyzer.analyzeKlines(klines);
      timeframeMatches[tf] = patterns;
      
      patterns.forEach(p => {
        totalPatterns++;
        // Weight longer timeframes slightly more for trend confirmation
        const weight = tf === '1h' ? 2 : tf === '15m' ? 1.5 : 1;
        
        if (p.type === 'BULLISH') bullishScore += p.confidence * weight;
        if (p.type === 'BEARISH') bearishScore += p.confidence * weight;
      });
    }

    // Rough max score estimation to normalize
    // We removed normalized calculations to avoid TS errors
    
    let type: SignalType = 'HOLD';
    let confidence = 0;
    let reason = 'Market is ranging, no clear scalping opportunity.';

    // Scalping logic for 2min - 1hr trades:
    // We look for strong alignment across multiple timeframes.
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

    return {
      type,
      symbol,
      timestamp: Date.now(),
      reason,
      timeframeMatches,
      confidence: Math.round(confidence)
    };
  }
}
