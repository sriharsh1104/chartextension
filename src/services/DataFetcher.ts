export type Kline = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '1h';

export class DataFetcher {
  /**
   * Fetches Klines (OHLCV) from Binance for Crypto pairs.
   */
  static async fetchBinanceKlines(symbol: string, interval: Timeframe, limit = 50): Promise<Kline[]> {
    try {
      // Clean symbol (e.g., BINANCE:BTCUSDT -> BTCUSDT)
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
    } catch (e) {
      console.warn(`Failed to fetch live data for ${symbol}. Returning mock data.`);
      return this.generateMockKlines(limit);
    }
  }

  /**
   * Mock data generator for non-crypto pairs where we lack free real-time APIs
   */
  static generateMockKlines(limit: number): Kline[] {
    const klines: Kline[] = [];
    let currentPrice = 2000;
    let time = Date.now() - limit * 60000;
    
    for (let i = 0; i < limit; i++) {
      const open = currentPrice;
      const high = open + Math.random() * 5;
      const low = open - Math.random() * 5;
      const close = low + Math.random() * (high - low);
      currentPrice = close;
      
      klines.push({
        timestamp: time + i * 60000,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000,
      });
    }
    
    return klines;
  }
}
