import { useState } from 'react';
import { TradingViewWidget } from './components/TradingViewWidget';
import { SignalDashboard } from './components/SignalDashboard';
import './App.css';

const TRADING_PAIRS = [
  { id: 'GOLD', name: 'Gold (XAUUSD)', symbol: 'OANDA:XAUUSD' },
  { id: 'USOIL', name: 'US Oil (WTI)', symbol: 'TVC:USOIL' },
  { id: 'UKOIL', name: 'UK Oil (Brent)', symbol: 'TVC:UKOIL' },
  { id: 'EURUSD', name: 'EUR/USD', symbol: 'FX:EURUSD' },
  { id: 'GBPUSD', name: 'GBP/USD', symbol: 'FX:GBPUSD' },
  { id: 'USDJPY', name: 'USD/JPY', symbol: 'FX:USDJPY' },
  { id: 'BTCUSDT', name: 'Bitcoin (BTC/USDT)', symbol: 'BINANCE:BTCUSDT' },
  { id: 'ETHUSDT', name: 'Ethereum (ETH/USDT)', symbol: 'BINANCE:ETHUSDT' },
];

function App() {
  const [activePairId, setActivePairId] = useState<string>(TRADING_PAIRS[0].id);

  const activePair = TRADING_PAIRS.find(pair => pair.id === activePairId) || TRADING_PAIRS[0];

  return (
    <div className="app-container">
      <header className="header">
        <h1>Trading Signals Pro</h1>
        <div className="status-badge">Live Feed</div>
      </header>
      
      <div className="controls-container">
        <select 
          className="pair-selector"
          value={activePairId}
          onChange={(e) => setActivePairId(e.target.value)}
        >
          {TRADING_PAIRS.map(pair => (
            <option key={pair.id} value={pair.id}>
              {pair.name}
            </option>
          ))}
        </select>
      </div>

      <div className="dashboard-layout">
        <div className="chart-section">
          <TradingViewWidget key={activePair.symbol} symbol={activePair.symbol} />
        </div>
        <div className="sidebar-section">
          <SignalDashboard symbol={activePair.symbol} />
        </div>
      </div>
    </div>
  );
}

export default App;
