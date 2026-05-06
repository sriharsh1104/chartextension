import React, { useEffect, useState } from 'react';
import './MarketSessions.css';

type Session = {
  name: string;
  shortName: string;
  flag: string;
  timezone: string;
  openHour: number;  // UTC hour
  closeHour: number; // UTC hour
  pairs: string[];
  color: string;
};

const SESSIONS: Session[] = [
  {
    name: 'Sydney',
    shortName: 'SYD',
    flag: '🇦🇺',
    timezone: 'Australia/Sydney',
    openHour: 21, // 21:00 UTC (prev day)
    closeHour: 6, // 06:00 UTC
    pairs: ['AUD/USD', 'NZD/USD'],
    color: '#7c3aed',
  },
  {
    name: 'Tokyo',
    shortName: 'TYO',
    flag: '🇯🇵',
    timezone: 'Asia/Tokyo',
    openHour: 0, // 00:00 UTC
    closeHour: 9, // 09:00 UTC
    pairs: ['USD/JPY', 'EUR/JPY'],
    color: '#dc2626',
  },
  {
    name: 'London',
    shortName: 'LDN',
    flag: '🇬🇧',
    timezone: 'Europe/London',
    openHour: 8, // 08:00 UTC
    closeHour: 17, // 17:00 UTC
    pairs: ['GBP/USD', 'EUR/USD', 'XAU/USD'],
    color: '#2563eb',
  },
  {
    name: 'New York',
    shortName: 'NYC',
    flag: '🇺🇸',
    timezone: 'America/New_York',
    openHour: 13, // 13:00 UTC
    closeHour: 22, // 22:00 UTC
    pairs: ['EUR/USD', 'XAU/USD', 'Oil'],
    color: '#059669',
  },
];

function getUtcHour(): number {
  return new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
}

function isSessionOpen(session: Session, utcHour: number): boolean {
  if (session.openHour < session.closeHour) {
    return utcHour >= session.openHour && utcHour < session.closeHour;
  } else {
    // Overnight session (e.g. Sydney: 21:00–06:00)
    return utcHour >= session.openHour || utcHour < session.closeHour;
  }
}

function getLocalTime(timezone: string): string {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function minutesUntilNextEvent(session: Session, utcHour: number): { label: string; minutes: number } {
  const nowMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  const open = session.openHour < session.closeHour ? session.openHour : session.openHour;
  const close = session.closeHour;

  if (isSessionOpen(session, utcHour)) {
    // Minutes until close
    let closeMinutes = close * 60;
    let diff = closeMinutes - nowMinutes;
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return { label: `Closes in ${h}h ${m}m`, minutes: diff };
  } else {
    // Minutes until open
    let openMinutes = open * 60;
    let diff = openMinutes - nowMinutes;
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return { label: `Opens in ${h}h ${m}m`, minutes: diff };
  }
}

// Check if London + New York overlap (most volatile)
function isOverlapSession(utcHour: number): boolean {
  return utcHour >= 13 && utcHour < 17; // 13:00–17:00 UTC = best overlap
}

export const MarketSessions: React.FC = () => {
  const [utcHour, setUtcHour] = useState(getUtcHour());

  useEffect(() => {
    const interval = setInterval(() => setUtcHour(getUtcHour()), 30000); // every 30s
    return () => clearInterval(interval);
  }, []);

  const overlap = isOverlapSession(utcHour);
  const openCount = SESSIONS.filter((s) => isSessionOpen(s, utcHour)).length;

  return (
    <div className="market-sessions-container">
      <div className="sessions-header">
        <div className="sessions-title">
          <span className="sessions-icon">🌍</span>
          <span>Market Sessions</span>
        </div>
        <div className="sessions-meta">
          {overlap && (
            <span className="overlap-badge">
              🔥 London-NY Overlap
            </span>
          )}
          <span className="utc-time">
            UTC {new Date().toUTCString().slice(17, 22)}
          </span>
        </div>
      </div>

      <div className="sessions-grid">
        {SESSIONS.map((session) => {
          const open = isSessionOpen(session, utcHour);
          const localTime = getLocalTime(session.timezone);
          const { label } = minutesUntilNextEvent(session, utcHour);

          return (
            <div
              key={session.name}
              className={`session-card ${open ? 'open' : 'closed'}`}
              style={{ '--session-color': session.color } as React.CSSProperties}
            >
              <div className="session-top">
                <div className="session-name-row">
                  <span className="session-flag">{session.flag}</span>
                  <span className="session-name">{session.name}</span>
                  <span className={`session-status-dot ${open ? 'open' : 'closed'}`} />
                </div>
                <span className="session-local-time">{localTime}</span>
              </div>

              <div className="session-bar-wrap">
                <div
                  className="session-bar-fill"
                  style={{ background: open ? session.color : '#30363d' }}
                />
              </div>

              <div className="session-bottom">
                <span className={`session-countdown ${open ? 'open' : 'closed'}`}>
                  {open ? '🟢' : '🔴'} {label}
                </span>
                <span className="session-pairs">{session.pairs.join(' · ')}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sessions-tip">
        💡 Best trades: <strong>London Open</strong> (08:00 UTC) &amp; <strong>NY-London Overlap</strong> (13:00–17:00 UTC)
      </div>
    </div>
  );
};
