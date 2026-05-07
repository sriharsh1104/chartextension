import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SignalGenerator, Signal, SignalType } from '../services/SignalGenerator';
import { VolatilityReport } from '../services/VolatilityAnalyzer';
import { Activity, TrendingUp, TrendingDown, AlertCircle, Radio, X, Zap, Clock, ArrowUpCircle, ArrowDownCircle, MinusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import './SignalDashboard.css';

interface Props { symbol: string; }

// ─── IST ──────────────────────────────────────────────────────────────────────
function toIST(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

// ─── Beep ────────────────────────────────────────────────────────────────────
function playReversalBeep(isExit: boolean) {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isExit ? 660 : 880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isExit ? 330 : 660, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  } catch (_) {}
}

// ─── Reversal Banner ─────────────────────────────────────────────────────────
interface ReversalAlert { from: SignalType; to: SignalType; timestamp: number; }

const ReversalBanner: React.FC<{ alert: ReversalAlert; onDismiss: () => void }> = ({ alert, onDismiss }) => {
  const isFlip = (alert.from === 'BUY' && (alert.to === 'SELL' || alert.to === 'SHORT')) ||
                 ((alert.from === 'SELL' || alert.from === 'SHORT') && alert.to === 'BUY');
  const isExit = !isFlip && (alert.from === 'BUY' || alert.from === 'SELL' || alert.from === 'SHORT') && alert.to === 'HOLD';
  const message = isFlip
    ? `⚡ FLIP! ${alert.from}→${alert.to} — EXIT & REVERSE!`
    : isExit
    ? `⚠️ ${alert.from} CANCELLED — EXIT TRADE!`
    : `🟢 NEW ${alert.to} SIGNAL`;
  const colorClass = isFlip ? 'reversal-flip' : isExit ? 'reversal-exit' : 'reversal-new';
  return (
    <div className={`reversal-banner ${colorClass}`}>
      <span className="reversal-text">{message}</span>
      <span className="reversal-time">{toIST(alert.timestamp)}</span>
      <button className="reversal-dismiss" onClick={onDismiss}><X size={14} /></button>
    </div>
  );
};

// ─── Volatility Meter ────────────────────────────────────────────────────────
const VolatilityMeter: React.FC<{ vol: VolatilityReport; signalType: string }> = ({ vol, signalType }) => {
  const isHighVol = vol.level === 'HIGH' || vol.level === 'MEDIUM';
  const direction = signalType === 'BUY' ? '↑ BUY' : (signalType === 'SELL' || signalType === 'SHORT') ? '↓ SELL' : '— WAIT';
  const dirColor  = signalType === 'BUY' ? '#26a69a' : (signalType === 'SELL' || signalType === 'SHORT') ? '#ef5350' : '#8b949e';
  return (
    <div className="vol-stat-row">
      <div className="vol-stat-box">
        <span className="vol-stat-label">Volatility</span>
        <span className="vol-stat-value" style={{ color: isHighVol ? '#26a69a' : '#ef5350' }}>{vol.level}</span>
      </div>
      <div className="vol-stat-divider" />
      <div className="vol-stat-box">
        <span className="vol-stat-label">Direction</span>
        <span className="vol-stat-value" style={{ color: dirColor }}>{direction}</span>
      </div>
    </div>
  );
};

// ─── Signal Age ───────────────────────────────────────────────────────────────
const SignalAge: React.FC<{ timestamp: number }> = ({ timestamp }) => {
  const [age, setAge] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAge(Math.floor((Date.now() - timestamp) / 1000)), 1000);
    return () => clearInterval(t);
  }, [timestamp]);
  const isStale = age > 20;
  return (
    <span className={`signal-age ${isStale ? 'stale' : ''}`}>
      <Clock size={9} style={{ marginRight: 3 }} />
      {toIST(timestamp)} {isStale ? `(${age}s ago)` : age < 3 ? '🔴 FRESH' : `${age}s ago`}
    </span>
  );
};

// ─── 1H Trend Card ───────────────────────────────────────────────────────────
const TrendCard: React.FC<{ signal: Signal }> = ({ signal }) => {
  const { trend, type: entryType } = signal;
  const dir = trend.direction;
  const icon =
    dir === 'BULLISH' ? <ArrowUpCircle size={22} className="trend-icon bullish" /> :
    dir === 'BEARISH' ? <ArrowDownCircle size={22} className="trend-icon bearish" /> :
                        <MinusCircle    size={22} className="trend-icon neutral" />;
  const holdLabel =
    entryType === 'HOLD' ? null
      : trend.alignedWith5m
      ? <span className="hold-badge aligned">✅ Hold OK</span>
      : <span className="hold-badge against">⚡ Scalp Only</span>;
  return (
    <div className={`trend-card ${dir.toLowerCase()}`}>
      <div className="trend-card-header">
        <span className="trend-card-title">1H Macro Trend</span>
        {holdLabel}
      </div>
      <div className="trend-card-body">
        {icon}
        <div className="trend-card-info">
          <span className="trend-direction-label" style={{
            color: dir === 'BULLISH' ? '#26a69a' : dir === 'BEARISH' ? '#ef5350' : '#8b949e'
          }}>{dir}</span>
          <p className="trend-reason">{trend.reason}</p>
        </div>
      </div>
    </div>
  );
};

// ─── Category color map ───────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  CANDLESTICK: '#a371f7', TREND: '#58a6ff', MOMENTUM: '#f0883e', VOLATILITY: '#ffa657',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isSellType = (t: SignalType) => t === 'SELL' || t === 'SHORT';

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export const SignalDashboard: React.FC<Props> = ({ symbol }) => {
  const [signal,         setSignal]         = useState<Signal | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [isUpdating,     setIsUpdating]     = useState(false);
  const [priceFlash,     setPriceFlash]     = useState(false);
  const [reversalAlert,  setReversalAlert]  = useState<ReversalAlert | null>(null);
  const [isBinance,      setIsBinance]      = useState(false);
  const [showPatterns,   setShowPatterns]   = useState(false);
  const prevSignalTypeRef = useRef<SignalType | undefined>(undefined);

  const handleNewSignal = useCallback((result: Signal) => {
    setIsUpdating(true);
    setSignal(prev => {
      if (prev?.entryPrice !== result.entryPrice && result.entryPrice) {
        setPriceFlash(true);
        setTimeout(() => setPriceFlash(false), 700);
      }
      const prevType = prevSignalTypeRef.current;
      const newType  = result.type;
      if (prevType && prevType !== newType) {
        const wasActive = prevType === 'BUY' || isSellType(prevType);
        const meaningful = wasActive && (newType === 'HOLD' || newType === 'BUY' || isSellType(newType));
        if (meaningful) {
          setReversalAlert({ from: prevType, to: newType, timestamp: Date.now() });
          playReversalBeep(newType === 'HOLD');
          if (Notification.permission === 'granted') {
            const isFlip = (prevType === 'BUY' && isSellType(newType)) || (isSellType(prevType) && newType === 'BUY');
            new Notification(isFlip ? `⚡ ${symbol} FLIP!` : `⚠️ ${symbol} Signal Gone`, {
              body: isFlip ? `${prevType}→${newType} — Exit & reverse!` : `${prevType} cancelled — exit now!`,
              icon: '/favicon.ico',
            });
          }
        }
      }
      prevSignalTypeRef.current = newType;
      return result;
    });
    setLoading(false);
    setTimeout(() => setIsUpdating(false), 400);
  }, [symbol]);

  useEffect(() => {
    if (Notification.permission === 'default') Notification.requestPermission();
    setIsBinance(symbol.startsWith('BINANCE:'));
    setLoading(true);
    return SignalGenerator.subscribeRealtime(symbol, handleNewSignal);
  }, [symbol, handleNewSignal]);

  if (loading && !signal) {
    return (
      <div className="signal-dashboard loading">
        <Activity className="spinner" size={24} />
        <p>Analyzing 1m → 1h timeframes (IST)...</p>
      </div>
    );
  }
  if (!signal) return null;

  const signalColor = signal.type === 'BUY' ? '#26a69a' : isSellType(signal.type) ? '#ef5350' : '#8b949e';

  // Pattern filtering for breakdown
  const relevantType: 'BULLISH' | 'BEARISH' | null =
    signal.type === 'BUY' ? 'BULLISH' : isSellType(signal.type) ? 'BEARISH' : null;

  const entryTFs = ['1m', '3m', '5m'];
  const patternsByCategory = Object.entries(signal.timeframeMatches).reduce<
    Record<string, { tf: string; name: string; type: string; category: string }[]>
  >((acc, [tf, patterns]) => {
    if (!entryTFs.includes(tf)) return acc;
    patterns?.forEach(p => {
      if (relevantType && p.type !== relevantType) return;
      if (!relevantType && p.type === 'NEUTRAL') return;
      const cat = p.category || 'OTHER';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({ tf, name: p.name, type: p.type, category: cat });
    });
    return acc;
  }, {});

  if (!relevantType) {
    Object.keys(patternsByCategory).forEach(cat => {
      const b = patternsByCategory[cat].filter(p => p.type === 'BULLISH').slice(0, 2);
      const s = patternsByCategory[cat].filter(p => p.type === 'BEARISH').slice(0, 2);
      patternsByCategory[cat] = [...b, ...s];
      if (!patternsByCategory[cat].length) delete patternsByCategory[cat];
    });
  }

  const totalRelevant = Object.values(patternsByCategory).reduce((s, a) => s + a.length, 0);

  return (
    <div className={`signal-dashboard ${signal.type.toLowerCase()}`}>

      {reversalAlert && (
        <ReversalBanner alert={reversalAlert} onDismiss={() => setReversalAlert(null)} />
      )}

      {/* Header */}
      <div className="signal-header">
        <div className="signal-title-group">
          <h3>5m Entry Signal</h3>
          <div className={`live-badge ${isUpdating ? 'updating' : ''}`}>
            {isBinance
              ? <><Zap size={9} className="live-radio-icon" /><span>WS</span></>
              : <><Radio size={9} className="live-radio-icon" /><span>LIVE</span></>
            }
          </div>
        </div>
        <SignalAge timestamp={signal.timestamp} />
      </div>

      {/* Volatility */}
      <VolatilityMeter vol={signal.volatility} signalType={signal.type} />

      {/* Signal + Confidence */}
      <div className="signal-main">
        <div className="signal-type">
          {signal.type === 'BUY' && <TrendingUp size={32} className="icon-buy" />}
          {isSellType(signal.type) && <TrendingDown size={32} className="icon-sell" />}
          {signal.type === 'HOLD' && <AlertCircle size={32} className="icon-hold" />}
          <h2>{signal.type}</h2>
        </div>
        <div className="signal-confidence">
          <div className="confidence-bar">
            <div className="confidence-fill" style={{
              width: `${signal.confidence}%`, backgroundColor: signalColor,
            }} />
          </div>
          <span className="confidence-text">{signal.confidence}% Confidence</span>
        </div>
      </div>

      {/* ── CORE Score (EMA + RSI + MACD) ── */}
      <div className="score-section">
        <div className="score-row">
          <span className="score-label">⚙️ Core (EMA · RSI · MACD)</span>
          <span className="score-value" style={{ color: signal.coreScore >= 3 ? '#26a69a' : '#8b949e' }}>
            {signal.coreScore}/{signal.coreMax}
            {signal.coreScore >= 3 ? ' ✓' : ` — need ${3 - signal.coreScore} more`}
          </span>
        </div>
        <div className="score-pips">
          {Array.from({ length: signal.coreMax }).map((_, i) => (
            <div key={i} className={`score-pip ${i < signal.coreScore ? (signal.type === 'BUY' ? 'filled-buy' : isSellType(signal.type) ? 'filled-sell' : 'filled-hold') : ''} ${i === 2 ? 'threshold-pip' : ''}`} />
          ))}
        </div>
        {signal.coreReasons.length > 0 && (
          <div className="score-reasons">{signal.coreReasons.join(' · ')}</div>
        )}
      </div>

      {/* ── BONUS Score (Stoch + Vol + Patterns) ── */}
      <div className="score-section bonus-section">
        <div className="score-row">
          <span className="score-label">🎯 Bonus (Stoch · Vol · Patterns)</span>
          <span className="score-value" style={{ color: signal.bonusScore > 0 ? '#58a6ff' : '#484f58' }}>
            +{signal.bonusScore}/{signal.bonusMax}
          </span>
        </div>
        {signal.bonusScore > 0 && (
          <div className="score-pips bonus-pips">
            {Array.from({ length: signal.bonusMax }).map((_, i) => (
              <div key={i} className={`score-pip ${i < signal.bonusScore ? 'filled-bonus' : ''}`} />
            ))}
          </div>
        )}
        {signal.bonusReasons.length > 0 && (
          <div className="score-reasons bonus-reasons">{signal.bonusReasons.join(' · ')}</div>
        )}
      </div>

      <p className="signal-reason">{signal.reason}</p>

      {/* Low Vol Warning */}
      {signal.isLowVolWarning && (
        <div className="low-vol-warning">
          ⚠️ <strong>Low Volatility</strong> — Smaller position size. Whipsaw risk higher.
        </div>
      )}

      {/* Entry / TP / SL */}
      {signal.entryPrice && (
        <div className={`signal-targets ${priceFlash ? 'price-flash' : ''} ${signal.type === 'HOLD' ? 'targets-pending' : ''}`}>
          {signal.type === 'HOLD' && (
            <div className="targets-pending-label">Planned Levels (core {signal.coreScore}/{signal.coreMax} — not fired yet)</div>
          )}
          <div className="targets-row">
            <div className="target-item entry">
              <span className="target-label">Entry</span>
              <span className="target-value">{signal.entryPrice >= 1000 ? signal.entryPrice.toFixed(2) : signal.entryPrice.toFixed(4)}</span>
            </div>
            <div className="target-item tp">
              <span className="target-label">Take Profit</span>
              <span className="target-value">{signal.takeProfit! >= 1000 ? signal.takeProfit!.toFixed(2) : signal.takeProfit!.toFixed(4)}</span>
            </div>
            <div className="target-item sl">
              <span className="target-label">Stop Loss</span>
              <span className="target-value">{signal.stopLoss! >= 1000 ? signal.stopLoss!.toFixed(2) : signal.stopLoss!.toFixed(4)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 1H Trend */}
      <TrendCard signal={signal} />

      {/* Pattern Breakdown — collapsible */}
      <div className="timeframe-breakdown">
        <h4
          className="patterns-toggle"
          onClick={() => setShowPatterns(p => !p)}
        >
          {signal.type === 'BUY'
            ? '📈 Bullish Patterns'
            : isSellType(signal.type)
            ? '📉 Bearish Patterns'
            : signal.trend.direction === 'BULLISH'
            ? '⏳ Bullish Patterns (wait)'
            : signal.trend.direction === 'BEARISH'
            ? '⏳ Bearish Patterns (wait)'
            : '⚖️ All Patterns'
          }
          <span className="pattern-count-badge">{totalRelevant}</span>
          {showPatterns ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </h4>
        {showPatterns && (
          <div className="patterns-content">
            {totalRelevant === 0 && (
              <p className="no-patterns-msg">No bonus pattern matches right now. Core indicators are sufficient for signal.</p>
            )}
            {Object.entries(patternsByCategory).map(([cat, items]) => (
              <div key={cat} className="pattern-category-group">
                <div className="pattern-category-label" style={{ color: CATEGORY_COLORS[cat] ?? '#8b949e' }}>{cat}</div>
                <div className="tf-patterns">
                  {items.map((item, i) => (
                    <span key={i} className={`pattern-tag ${item.type.toLowerCase()}`} title={`${item.tf} timeframe`}>
                      <span className="pattern-tf-badge">{item.tf}</span>
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
