import React, { useEffect, useState } from 'react';
import { SignalGenerator, Signal } from '../services/SignalGenerator';
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import './SignalDashboard.css';

interface Props {
  symbol: string;
}

export const SignalDashboard: React.FC<Props> = ({ symbol }) => {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const fetchSignal = async () => {
      setLoading(true);
      try {
        const result = await SignalGenerator.generateSignalForSymbol(symbol);
        if (mounted) {
          setSignal(result);
        }
      } catch (err) {
        console.error("Error generating signal", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSignal();
    
    // Refresh signal every 1 minute
    const intervalId = setInterval(fetchSignal, 60000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [symbol]);

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
        <h3>Live AI Scalping Signal</h3>
        <span className="timeframe-badge">2m - 1h Hold</span>
      </div>

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
              style={{ width: `${signal.confidence}%`, backgroundColor: signal.type === 'BUY' ? '#26a69a' : signal.type === 'SHORT' ? '#ef5350' : '#8b949e' }}
            ></div>
          </div>
          <span className="confidence-text">{signal.confidence}% Confidence</span>
        </div>
      </div>

      <p className="signal-reason">{signal.reason}</p>
      
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
