import { Kline } from './DataFetcher';

type KlineCallback = (kline: Kline, isClosed: boolean) => void;

interface StreamEntry {
  ws: WebSocket;
  callbacks: Set<KlineCallback>;
  latestKline: Kline | null;
}

/**
 * Manages persistent Binance WebSocket streams.
 * Multiple consumers can subscribe to the same symbol stream
 * without opening duplicate connections.
 */
export class BinanceStream {
  private static streams = new Map<string, StreamEntry>();

  /**
   * Subscribe to real-time 1m kline stream for a Binance symbol.
   * Returns an unsubscribe function.
   */
  static subscribe(rawSymbol: string, onKline: KlineCallback): () => void {
    const symbol = rawSymbol.split(':').pop()!.toLowerCase();
    const key = symbol;

    if (!this.streams.has(key)) {
      this._openStream(key, symbol);
    }

    const entry = this.streams.get(key)!;
    entry.callbacks.add(onKline);

    // Immediately emit latest kline if available
    if (entry.latestKline) {
      onKline(entry.latestKline, false);
    }

    return () => {
      const e = this.streams.get(key);
      if (!e) return;
      e.callbacks.delete(onKline);
      if (e.callbacks.size === 0) {
        e.ws.close();
        this.streams.delete(key);
      }
    };
  }

  private static _openStream(key: string, symbol: string) {
    const url = `wss://stream.binance.com:9443/ws/${symbol}@kline_1m`;
    const ws = new WebSocket(url);

    const entry: StreamEntry = { ws, callbacks: new Set(), latestKline: null };
    this.streams.set(key, entry);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const k = msg.k;
        const kline: Kline = {
          timestamp: k.t,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };
        const isClosed: boolean = k.x; // true when candle is finalized

        entry.latestKline = kline;
        entry.callbacks.forEach(cb => cb(kline, isClosed));
      } catch (_) {}
    };

    ws.onerror = () => console.warn(`[BinanceStream] Error on ${symbol}`);

    ws.onclose = () => {
      // Auto-reconnect after 2s if still needed
      const e = this.streams.get(key);
      if (e && e.callbacks.size > 0) {
        setTimeout(() => this._openStream(key, symbol), 2000);
      }
    };
  }

  /** Returns the latest live price for a symbol (if connected) */
  static getLatestPrice(rawSymbol: string): number | null {
    const key = rawSymbol.split(':').pop()!.toLowerCase();
    return this.streams.get(key)?.latestKline?.close ?? null;
  }
}
