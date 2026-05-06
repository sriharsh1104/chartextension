export type NewsEvent = {
  title: string;
  country: string;
  date: Date;
  impact: 'High' | 'Medium' | 'Low' | 'Holiday';
  forecast: string;
  previous: string;
  minutesUntil: number;
};

// High-impact keywords for Gold, Oil, Forex
const HIGH_PRIORITY_KEYWORDS = [
  'powell', 'fomc', 'fed', 'non-farm', 'nonfarm', 'nfp',
  'cpi', 'inflation', 'interest rate', 'gdp', 'unemployment',
  'ism', 'jolts', 'pce', 'rba', 'boe', 'ecb', 'bank of',
  'crude oil', 'opec', 'oil inventories', 'consumer sentiment',
  'initial jobless', 'unemployment claims', 'retail sales',
  'press conference', 'rate statement', 'rate decision',
  'monetary policy', 'hawkish', 'dovish',
];

const PRIORITY_COUNTRIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];

const CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const NEXT_WEEK_URL = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

function parseEvents(raw: any[], cutoffStart: Date, cutoffEnd: Date): NewsEvent[] {
  const now = new Date();
  return raw
    .filter((item) => {
      if (!item.date || item.impact === 'Holiday') return false;
      const eventDate = new Date(item.date);
      if (eventDate < cutoffStart || eventDate > cutoffEnd) return false;
      const isHighOrMedium = item.impact === 'High' || item.impact === 'Medium';
      const isLowKeyword = item.impact === 'Low' && HIGH_PRIORITY_KEYWORDS.some((kw) =>
        item.title?.toLowerCase().includes(kw)
      );
      const isPriorityCountry = PRIORITY_COUNTRIES.includes(item.country);
      return (isHighOrMedium || isLowKeyword) && isPriorityCountry;
    })
    .map((item) => {
      const eventDate = new Date(item.date);
      return {
        title: item.title,
        country: item.country,
        date: eventDate,
        impact: item.impact as NewsEvent['impact'],
        forecast: item.forecast || '',
        previous: item.previous || '',
        minutesUntil: Math.round((eventDate.getTime() - now.getTime()) / 60000),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export class NewsFetcher {
  /** Today + next 48h events */
  static async fetchUpcomingEvents(): Promise<NewsEvent[]> {
    try {
      const now = new Date();
      const cutoffPast = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const cutoffFuture = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const response = await fetch(CALENDAR_URL);
      if (!response.ok) throw new Error('Failed to fetch calendar');
      const raw: any[] = await response.json();

      // Also try next week if needed
      let combined = [...raw];
      try {
        const nextRes = await fetch(NEXT_WEEK_URL);
        if (nextRes.ok) {
          const nextRaw: any[] = await nextRes.json();
          combined = [...raw, ...nextRaw];
        }
      } catch (_) {}

      return parseEvents(combined, cutoffPast, cutoffFuture);
    } catch (err) {
      console.error('News fetch failed:', err);
      return [];
    }
  }

  /** Tomorrow's events only (next calendar day) */
  static async fetchTomorrowEvents(): Promise<NewsEvent[]> {
    try {
      const now = new Date();
      // Tomorrow: midnight to midnight+24h (in local time)
      const tomorrowStart = new Date(now);
      tomorrowStart.setHours(24, 0, 0, 0); // Start of tomorrow
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setHours(48, 0, 0, 0); // End of tomorrow

      const response = await fetch(CALENDAR_URL);
      if (!response.ok) throw new Error('Failed to fetch calendar');
      const raw: any[] = await response.json();

      let combined = [...raw];
      try {
        const nextRes = await fetch(NEXT_WEEK_URL);
        if (nextRes.ok) {
          const nextRaw: any[] = await nextRes.json();
          combined = [...raw, ...nextRaw];
        }
      } catch (_) {}

      // For tomorrow, include ALL impact levels but only priority countries
      const allFiltered = combined
        .filter((item) => {
          if (!item.date || item.impact === 'Holiday') return false;
          const eventDate = new Date(item.date);
          if (eventDate < tomorrowStart || eventDate > tomorrowEnd) return false;
          return PRIORITY_COUNTRIES.includes(item.country);
        })
        .map((item) => {
          const eventDate = new Date(item.date);
          return {
            title: item.title,
            country: item.country,
            date: eventDate,
            impact: item.impact as NewsEvent['impact'],
            forecast: item.forecast || '',
            previous: item.previous || '',
            minutesUntil: Math.round((eventDate.getTime() - now.getTime()) / 60000),
          };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      return allFiltered;
    } catch (err) {
      console.error('Tomorrow news fetch failed:', err);
      return [];
    }
  }

  static formatTimeUntil(minutesUntil: number): string {
    if (minutesUntil < -60) return 'Passed';
    if (minutesUntil < 0) return `${Math.abs(minutesUntil)}m ago`;
    if (minutesUntil < 60) return `In ${minutesUntil}m`;
    const hours = Math.floor(minutesUntil / 60);
    const mins = minutesUntil % 60;
    return mins > 0 ? `In ${hours}h ${mins}m` : `In ${hours}h`;
  }

  static getAlertLevel(events: NewsEvent[]): 'danger' | 'warning' | 'clear' {
    const imminent = events.filter((e) => e.minutesUntil >= -10 && e.minutesUntil <= 60);
    const soonHigh = events.filter(
      (e) => e.minutesUntil >= 0 && e.minutesUntil <= 120 && e.impact === 'High'
    );
    if (imminent.some((e) => e.impact === 'High')) return 'danger';
    if (soonHigh.length > 0 || imminent.length > 0) return 'warning';
    return 'clear';
  }
}
