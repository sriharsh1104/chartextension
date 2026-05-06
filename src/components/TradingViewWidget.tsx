interface TradingViewWidgetProps {
  symbol: string;
}

export const TradingViewWidget = ({ symbol }: TradingViewWidgetProps) => {
  // Construct the TradingView widget iframe URL manually.
  // This bypasses Chrome Extension Manifest V3 CSP issues with external script injection.
  const chartSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(symbol)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&theme=dark&style=1&timezone=Etc%2FUTC`;
  
  const techAnalysisConfig = {
    interval: "15m",
    width: "100%",
    isTransparent: false,
    height: 450,
    symbol: symbol,
    showIntervalTabs: true,
    displayMode: "single",
    locale: "en",
    colorTheme: "dark"
  };
  const techAnalysisSrc = `https://s.tradingview.com/embed-widget/technical-analysis/?locale=en#${encodeURIComponent(JSON.stringify(techAnalysisConfig))}`;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chart Section */}
      <div style={{ width: '100%', height: '400px' }}>
        <iframe
          src={chartSrc}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="fullscreen"
          title={`TradingView Chart - ${symbol}`}
        />
      </div>
      
      {/* Technical Analysis Signals Section */}
      <div style={{ width: '100%', height: '450px', borderTop: '2px solid #30363d' }}>
        <iframe
          src={techAnalysisSrc}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="fullscreen"
          title={`TradingView Technical Analysis - ${symbol}`}
        />
      </div>
    </div>
  );
};
