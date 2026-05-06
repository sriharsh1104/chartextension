export type Kline = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '1h';

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  'OANDA:XAUUSD': 'GC=F',
  'TVC:USOIL': 'CL=F',
  'TVC:UKOIL': 'BZ=F',
  'FX:EURUSD': 'EURUSD=X',
  'FX:GBPUSD': 'GBPUSD=X',
  'FX:USDJPY': 'JPY=X',
};

const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url='
];

export class DataFetcher {
  /**
   * Main entry point to fetch data based on symbol type
   */
  static async fetchKlines(symbol: string, interval: Timeframe, limit = 50): Promise<Kline[]> {
    if (symbol.startsWith('BINANCE:')) {
      return this.fetchBinanceKlines(symbol, interval, limit);
    } else {
      return this.fetchYahooKlinesWithRetry(symbol, interval, limit);
    }
  }

  static async fetchBinanceKlines(symbol: string, interval: Timeframe, limit = 50): Promise<Kline[]> {
    const cleanSymbol = symbol.split(':').pop() || symbol;
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`);
    if (!response.ok) throw new Error('Binance API failed');
    
    const data = await response.json();
    return data.map((d: any) => ({
      timestamp: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  }

  static async fetchYahooKlinesWithRetry(symbol: string, interval: Timeframe, limit = 50): Promise<Kline[]> {
    let lastError = null;
    for (const proxy of PROXIES) {
      try {
        return await this.fetchYahooKlines(symbol, interval, limit, proxy);
      } catch (err) {
        lastError = err;
        console.warn(`Proxy ${proxy} failed, trying next...`);
      }
    }
    throw lastError || new Error("All proxies failed");
  }

  static async fetchYahooKlines(symbol: string, interval: Timeframe, limit: number, proxyUrl: string): Promise<Kline[]> {
    const yahooSymbol = YAHOO_SYMBOL_MAP[symbol] || symbol;
    
    let yInterval = interval;
    if (interval === '3m') yInterval = '2m' as any; // Approx 3m
    if (interval === '1h') yInterval = '60m' as any;

    const targetUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${yInterval}&range=5d`);
    const response = await fetch(proxyUrl + targetUrl);
    
    if (!response.ok) throw new Error(`Yahoo API failed via proxy`);

    const data = await response.json();
    if (!data.chart || !data.chart.result) throw new Error("Invalid Yahoo format");

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0];

    const klines: Kline[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] !== null && quote.close[i] !== null) {
        klines.push({
          timestamp: timestamps[i] * 1000,
          open: quote.open[i],
          high: quote.high[i],
          low: quote.low[i],
          close: quote.close[i],
          volume: quote.volume[i] || 0,
        });
      }
    }

    return klines.slice(-limit);
  }
}

