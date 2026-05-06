import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SignalGenerator, Signal } from '../services/SignalGenerator';
import { VolatilityReport } from '../services/VolatilityAnalyzer';
import { Activity, TrendingUp, TrendingDown, AlertCircle, Radio } from 'lucide-react';
import './SignalDashboard.css';

interface Props {
  symbol: string;
}

// ─── Volatility Meter Component ──────────────────────────────
const VolatilityMeter: React.FC<{ vol: VolatilityReport; signalType: string }> = ({ vol, signalType }) => {
  const isHighVol = vol.level === 'HIGH' || vol.level === 'MEDIUM';
  const volLabel  = isHighVol ? 'HIGH' : 'LOW';
  const volColor  = isHighVol ? '#26a69a' : '#ef5350';

  // Direction based on signal + volume combo
  const direction =
    signalType === 'BUY'   ? '↑ LONG'  :
    signalType === 'SHORT' ? '↓ SHORT' : '— WAIT';
  const dirColor =
    signalType === 'BUY'   ? '#26a69a' :
    signalType === 'SHORT' ? '#ef5350' : '#8b949e';

  return (
    <div className="vol-stat-row">
      <div className="vol-stat-box">
        <span className="vol-stat-label">Volume</span>
        <span className="vol-stat-value" style={{ color: volColor }}>
          {volLabel}
        </span>
      </div>
      <div className="vol-stat-divider" />
      <div className="vol-stat-box">
        <span className="vol-stat-label">Direction</span>
        <span className="vol-stat-value" style={{ color: dirColor }}>
          {direction}
        </span>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────
export const SignalDashboard: React.FC<Props> = ({ symbol }) => {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [priceFlash, setPriceFlash] = useState<boolean>(false);
  const prevPriceRef = useRef<number | undefined>(undefined);

  const fetchSignal = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setIsUpdating(true);
    try {
      const result = await SignalGenerator.generateSignalForSymbol(symbol);
      setSignal(prev => {
        if (prev?.entryPrice !== result.entryPrice && result.entryPrice) {
          setPriceFlash(true);
          setTimeout(() => setPriceFlash(false), 700);
        }
        return result;
      });
    } catch (err) {
      console.error('Error generating signal', err);
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchSignal(true);
    const intervalId = setInterval(() => fetchSignal(false), 8000);
    return () => clearInterval(intervalId);
  }, [fetchSignal]);

  if (loading && !signal) {
    return (
      <div className="signal-dashboard loading">
        <Activity className="spinner" size={24} />
        <p>Analyzing multiple timeframes...</p>
      </div>
    );
  }

  if (!signal) return null;

  return (
    <div className={`signal-dashboard ${signal.type.toLowerCase()}`}>
      <div className="signal-header">
        <div className="signal-title-group">
          <h3>Live AI Scalping Signal</h3>
          <div className={`live-badge ${isUpdating ? 'updating' : ''}`}>
            <Radio size={9} className="live-radio-icon" />
            <span>LIVE</span>
          </div>
        </div>
        <span className="timeframe-badge">2m - 1h Hold</span>
      </div>

      {/* ── Volume + Direction Row ── */}
      <VolatilityMeter vol={signal.volatility} signalType={signal.type} />

      <div className="signal-main">
        <div className="signal-type">
          {signal.type === 'BUY' && <TrendingUp size={32} className="icon-buy" />}
          {signal.type === 'SHORT' && <TrendingDown size={32} className="icon-sell" />}
          {(signal.type === 'HOLD' || signal.type === 'SELL' || signal.type === 'COVER') && <AlertCircle size={32} className="icon-hold" />}
          <h2>{signal.type}</h2>
        </div>
        <div className="signal-confidence">
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{
                width: `${signal.confidence}%`,
                backgroundColor: signal.type === 'BUY' ? '#26a69a' : signal.type === 'SHORT' ? '#ef5350' : '#8b949e'
              }}
            />
          </div>
          <span className="confidence-text">{signal.confidence}% Confidence</span>
        </div>
      </div>

      <p className="signal-reason">{signal.reason}</p>

      {signal.entryPrice && (signal.type === 'BUY' || signal.type === 'SHORT') && (
        <div className={`signal-targets ${priceFlash ? 'price-flash' : ''}`}>
          <div className="target-item entry">
            <span className="target-label">Entry</span>
            <span className="target-value">
              {signal.entryPrice >= 1000 ? signal.entryPrice.toFixed(2) : signal.entryPrice.toFixed(4)}
            </span>
          </div>
          <div className="target-item tp">
            <span className="target-label">Take Profit</span>
            <span className="target-value">
              {signal.takeProfit! >= 1000 ? signal.takeProfit!.toFixed(2) : signal.takeProfit!.toFixed(4)}
            </span>
          </div>
          <div className="target-item sl">
            <span className="target-label">Stop Loss</span>
            <span className="target-value">
              {signal.stopLoss! >= 1000 ? signal.stopLoss!.toFixed(2) : signal.stopLoss!.toFixed(4)}
            </span>
          </div>
        </div>
      )}

      <div className="timeframe-breakdown">
        <h4>Pattern Breakdown:</h4>
        <div className="tf-list">
          {Object.entries(signal.timeframeMatches).map(([tf, patterns]) => {
            if (!patterns || patterns.length === 0) return null;
            return (
              <div key={tf} className="tf-item">
                <span className="tf-label">{tf}</span>
                <div className="tf-patterns">
                  {patterns.slice(0, 2).map((p, i) => (
                    <span key={i} className={`pattern-tag ${p.type.toLowerCase()}`}>
                      {p.name}
                    </span>
                  ))}
                  {patterns.length > 2 && <span className="pattern-tag more">+{patterns.length - 2} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
