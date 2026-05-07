import { DataFetcher, Timeframe, Kline } from './DataFetcher';
import { PatternAnalyzer, PatternResult } from './PatternAnalyzer';
import { VolatilityAnalyzer, VolatilityReport } from './VolatilityAnalyzer';
import { IndicatorEngine, IndicatorSnapshot } from './IndicatorEngine';
import { BinanceStream } from './BinanceStream';

export type SignalType = 'BUY' | 'SELL' | 'SHORT' | 'COVER' | 'HOLD';
export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type TrendContext = {
  direction: TrendDirection;
  holdable: boolean;
  alignedWith5m: boolean;
  reason: string;
};

export type Signal = {
  type: SignalType;
  symbol: string;
  timestamp: number;
  reason: string;
  timeframeMatches: Partial<Record<Timeframe, PatternResult[]>>;
  confidence: number;
  entryPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  volatility: VolatilityReport;
  trend: TrendContext;
  coreScore: number;        // Tier 1: EMA + RSI + MACD (max 7)
  bonusScore: number;       // Tier 2: Stoch + Vol + Pattern (max 5)
  coreMax: number;
  bonusMax: number;
  coreReasons: string[];
  bonusReasons: string[];
  isLowVolWarning: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// TIERED SIGNAL ENGINE
//
// TIER 1 — CORE (EMA + RSI + MACD): Signal fires if core ≥ 3/7
// TIER 2 — BONUS (Stochastic + Volume + Patterns): Adds confidence only
//
// Core indicators ALWAYS produce a clear signal — they don't conflict
// because EMA = trend, RSI = momentum zone, MACD = momentum direction.
// ─────────────────────────────────────────────────────────────────────────────

function scoreCore(
  snap: IndicatorSnapshot,
  bias: 'BULLISH' | 'BEARISH'
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (bias === 'BULLISH') {
    // EMA trend aligned (0–3)
    if (snap.emaTrend === 'BULLISH') {
      score += 2; reasons.push('EMA9>EMA21');
    }
    if (snap.priceVsEma50 === 'ABOVE') {
      score += 1; reasons.push('Price>EMA50');
    }
    // RSI zone (0–2)
    if (snap.rsi > 40 && snap.rsi < 75) {
      score += 1; reasons.push(`RSI ${snap.rsi.toFixed(0)} ✓`);
    }
    if (snap.rsiZone === 'OVERSOLD') {
      score += 1; reasons.push(`RSI oversold ${snap.rsi.toFixed(0)} — reversal`);
    }
    // MACD (0–2)
    if (snap.macdBias === 'BULLISH') {
      score += 2; reasons.push('MACD ↑');
    }
  } else {
    // EMA trend aligned (0–3)
    if (snap.emaTrend === 'BEARISH') {
      score += 2; reasons.push('EMA9<EMA21');
    }
    if (snap.priceVsEma50 === 'BELOW') {
      score += 1; reasons.push('Price<EMA50');
    }
    // RSI zone (0–2)
    if (snap.rsi > 25 && snap.rsi < 60) {
      score += 1; reasons.push(`RSI ${snap.rsi.toFixed(0)} ✓`);
    }
    if (snap.rsiZone === 'OVERBOUGHT') {
      score += 1; reasons.push(`RSI overbought ${snap.rsi.toFixed(0)} — reversal`);
    }
    // MACD (0–2)
    if (snap.macdBias === 'BEARISH') {
      score += 2; reasons.push('MACD ↓');
    }
  }

  return { score, reasons };
}

function scoreBonus(
  snap5m: IndicatorSnapshot,
  snap1m: IndicatorSnapshot | null,
  bias: 'BULLISH' | 'BEARISH'
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (bias === 'BULLISH') {
    if (snap5m.stochBias === 'BULLISH') {
      score += 1; reasons.push('Stoch ↑');
    }
    if (snap5m.volumeRatio > 1.3) {
      score += 1; reasons.push(`Vol ${snap5m.volumeRatio.toFixed(1)}×`);
    }
    const patterns = [
      ...(snap1m?.bullishPatterns ?? []),
      ...snap5m.bullishPatterns,
    ];
    if (patterns.length > 0) {
      score += Math.min(3, patterns.length);
      reasons.push(...patterns.slice(0, 3).map(p => p.name));
    }
  } else {
    if (snap5m.stochBias === 'BEARISH') {
      score += 1; reasons.push('Stoch ↓');
    }
    if (snap5m.volumeRatio > 1.3) {
      score += 1; reasons.push(`Vol ${snap5m.volumeRatio.toFixed(1)}×`);
    }
    const patterns = [
      ...(snap1m?.bearishPatterns ?? []),
      ...snap5m.bearishPatterns,
    ];
    if (patterns.length > 0) {
      score += Math.min(3, patterns.length);
      reasons.push(...patterns.slice(0, 3).map(p => p.name));
    }
  }

  return { score, reasons };
}

// ─── Main compute ─────────────────────────────────────────────────────────────
async function computeSignal(symbol: string, liveKline?: Kline): Promise<Signal> {
  const [klines1h, klines15m, klines5m, klines1m] = await Promise.all([
    DataFetcher.fetchKlines(symbol, '1h',  100),
    DataFetcher.fetchKlines(symbol, '15m', 100),
    DataFetcher.fetchKlines(symbol, '5m',  100),
    DataFetcher.fetchKlines(symbol, '1m',  100),
  ]);

  const live1m = liveKline ? [...klines1m.slice(0, -1), liveKline] : klines1m;
  const latestPrice = live1m.at(-1)?.close ?? 0;

  const snap1h  = IndicatorEngine.compute(klines1h);
  const snap15m = IndicatorEngine.compute(klines15m);
  const snap5m  = IndicatorEngine.compute(klines5m);
  const snap1m  = IndicatorEngine.compute(live1m);

  const volatility = VolatilityAnalyzer.analyze(live1m, latestPrice);

  const timeframeMatches: Partial<Record<Timeframe, PatternResult[]>> = {
    '1h':  PatternAnalyzer.analyzeKlines(klines1h),
    '15m': PatternAnalyzer.analyzeKlines(klines15m),
    '5m':  PatternAnalyzer.analyzeKlines(klines5m),
    '1m':  PatternAnalyzer.analyzeKlines(live1m),
  };

  // ─── STEP 1: Macro Bias from 1h EMA ─────────────────────────────────────
  // Simplified: just use 1h EMA. No 15m veto — it was blocking SHORT signals.
  const macroBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = snap1h?.emaTrend ?? 'NEUTRAL';

  // ─── STEP 2: Score ──────────────────────────────────────────────────────
  let type: SignalType = 'HOLD';
  let confidence = 0;
  let reason = '';
  let coreScore = 0, bonusScore = 0;
  let coreReasons: string[] = [];
  let bonusReasons: string[] = [];
  const coreMax = 7, bonusMax = 5;

  const CORE_THRESHOLD = 3; // need ≥3/7 core points — MUCH easier than before

  if (!snap5m) {
    reason = 'Insufficient data for 5m analysis.';
  } else if (macroBias === 'NEUTRAL') {
    // Even with neutral 1h, try 5m on its own for scalp
    const bias5m = snap5m.emaTrend;
    if (bias5m !== 'NEUTRAL') {
      const core  = scoreCore(snap5m, bias5m);
      const bonus = scoreBonus(snap5m, snap1m, bias5m);
      coreScore = core.score; coreReasons = core.reasons;
      bonusScore = bonus.score; bonusReasons = bonus.reasons;
      if (coreScore >= CORE_THRESHOLD) {
        type = bias5m === 'BULLISH' ? 'BUY' : 'SELL';
        confidence = Math.min(100, Math.round(((coreScore + bonusScore) / (coreMax + bonusMax)) * 100));
        reason = `${type}: 1h unclear but 5m ${bias5m} (core ${coreScore}/${coreMax}). Scalp only — ${coreReasons.join(' · ')}`;
      } else {
        reason = `1h unclear, 5m ${bias5m} but core weak (${coreScore}/${coreMax}). Wait.`;
      }
    } else {
      reason = '1h & 5m both unclear — no directional bias. Wait.';
    }
  } else {
    // 1h has bias — score 5m in that direction
    const core  = scoreCore(snap5m, macroBias);
    const bonus = scoreBonus(snap5m, snap1m, macroBias);
    coreScore = core.score; coreReasons = core.reasons;
    bonusScore = bonus.score; bonusReasons = bonus.reasons;
    const totalPct = Math.round(((coreScore + bonusScore) / (coreMax + bonusMax)) * 100);

    if (coreScore >= CORE_THRESHOLD) {
      type = macroBias === 'BULLISH' ? 'BUY' : 'SELL';
      confidence = Math.min(100, totalPct);
      const allReasons = [...coreReasons];
      if (bonusReasons.length > 0) allReasons.push(...bonusReasons);
      reason = `✅ ${type}: 1h ${macroBias} + 5m core ${coreScore}/${coreMax} — ${allReasons.join(' · ')}`;
    } else {
      reason = `1h ${macroBias} but 5m core not ready (${coreScore}/${coreMax}). Need ${CORE_THRESHOLD - coreScore} more. Wait.`;
    }
  }

  // ─── Volatility handling ──────────────────────────────────────────────────
  let isLowVolWarning = false;
  if (volatility.isTrap && (type === 'BUY' || type === 'SELL')) {
    if (coreScore >= 5) {
      isLowVolWarning = true;
      confidence = Math.round(confidence * 0.7);
      reason = `⚠️ Low vol (smaller size!) — ${reason}`;
    } else {
      type = 'HOLD';
      confidence = 0;
      reason = 'Low-volatility trap + weak core — suppressed. Wait for volatility.';
    }
  }

  // ─── 1h Trend Context ─────────────────────────────────────────────────────
  const alignedWith5m =
    (type === 'BUY'  && macroBias === 'BULLISH') ||
    (type === 'SELL' && macroBias === 'BEARISH');

  const trend: TrendContext = {
    direction: macroBias,
    holdable: macroBias !== 'NEUTRAL',
    alignedWith5m,
    reason: macroBias === 'NEUTRAL'
      ? '1h trend unclear — scalp only.'
      : alignedWith5m
      ? `1h is ${macroBias} — aligned. Can hold in profit.`
      : type === 'HOLD'
      ? `1h is ${macroBias}. Watching for 5m confirmation.`
      : `⚠️ 1h AGAINST ${type} — tight SL, quick scalp!`,
  };

  // ─── TP / SL ──────────────────────────────────────────────────────────────
  let entryPrice: number | undefined;
  let takeProfit: number | undefined;
  let stopLoss: number | undefined;

  const shouldShowLevels = (type === 'BUY' || type === 'SELL') || coreScore >= 3;
  if (shouldShowLevels && latestPrice > 0) {
    const atr = volatility.atr > 0 ? volatility.atr : latestPrice * 0.001;
    const dir = type === 'BUY' ? 'BUY' : type === 'SELL' ? 'SELL' : macroBias === 'BULLISH' ? 'BUY' : 'SELL';
    entryPrice = latestPrice;
    takeProfit = dir === 'BUY' ? latestPrice + atr * 2 : latestPrice - atr * 2;
    stopLoss   = dir === 'BUY' ? latestPrice - atr * 1 : latestPrice + atr * 1;
  }

  return {
    type, symbol,
    timestamp: Date.now(),
    reason, timeframeMatches,
    confidence: Math.round(confidence),
    entryPrice, takeProfit, stopLoss,
    volatility, trend,
    coreScore, bonusScore,
    coreMax, bonusMax,
    coreReasons, bonusReasons,
    isLowVolWarning,
  };
}

// ─── SignalGenerator ──────────────────────────────────────────────────────────
export class SignalGenerator {
  static async generateSignalForSymbol(symbol: string): Promise<Signal> {
    return computeSignal(symbol);
  }

  static subscribeRealtime(
    symbol: string,
    onSignal: (signal: Signal) => void
  ): () => void {
    if (!symbol.startsWith('BINANCE:')) {
      let active = true;
      const poll = async () => {
        if (!active) return;
        try { onSignal(await computeSignal(symbol)); } catch (_) {}
        if (active) setTimeout(poll, 5000);
      };
      poll();
      return () => { active = false; };
    }

    let computeDebounce: ReturnType<typeof setTimeout> | null = null;
    const triggerCompute = (kline: Kline | null, immediate = false) => {
      if (computeDebounce) clearTimeout(computeDebounce);
      computeDebounce = setTimeout(async () => {
        try { onSignal(await computeSignal(symbol, kline ?? undefined)); } catch (_) {}
      }, immediate ? 0 : 1500);
    };

    const unsubscribe = BinanceStream.subscribe(symbol, (kline, isClosed) => {
      if (isClosed) triggerCompute(null, true);
      else          triggerCompute(kline, false);
    });

    triggerCompute(null, true);

    return () => {
      unsubscribe();
      if (computeDebounce) clearTimeout(computeDebounce);
    };
  }
}
