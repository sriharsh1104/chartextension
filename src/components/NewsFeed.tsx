import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Bell, CheckCircle, Clock, Calendar } from 'lucide-react';
import { NewsFetcher, NewsEvent } from '../services/NewsFetcher';
import './NewsFeed.css';

const COUNTRY_FLAG: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭',
};

// Impact dots: High = 3 red dots, Medium = 2 orange dots, Low = 1 yellow dot
function ImpactDots({ impact }: { impact: NewsEvent['impact'] }) {
  if (impact === 'High') {
    return (
      <span className="impact-dots">
        <span className="dot red" />
        <span className="dot red" />
        <span className="dot red" />
      </span>
    );
  }
  if (impact === 'Medium') {
    return (
      <span className="impact-dots">
        <span className="dot orange" />
        <span className="dot orange" />
        <span className="dot grey" />
      </span>
    );
  }
  return (
    <span className="impact-dots">
      <span className="dot yellow" />
      <span className="dot grey" />
      <span className="dot grey" />
    </span>
  );
}

// Group events by date label
function groupByDay(events: NewsEvent[]): Record<string, NewsEvent[]> {
  const groups: Record<string, NewsEvent[]> = {};
  events.forEach((e) => {
    const label = e.date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  });
  return groups;
}

export const NewsFeed: React.FC = () => {
  const [upcomingEvents, setUpcomingEvents] = useState<NewsEvent[]>([]);
  const [tomorrowEvents, setTomorrowEvents] = useState<NewsEvent[]>([]);
  const [alertLevel, setAlertLevel] = useState<'danger' | 'warning' | 'clear'>('clear');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow'>('today');

  const fetchNews = useCallback(async () => {
    const [upcoming, tomorrow] = await Promise.all([
      NewsFetcher.fetchUpcomingEvents(),
      NewsFetcher.fetchTomorrowEvents(),
    ]);
    setUpcomingEvents(upcoming);
    setTomorrowEvents(tomorrow);
    setAlertLevel(NewsFetcher.getAlertLevel(upcoming));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    fetchNews();
    const newsInterval = setInterval(fetchNews, 5 * 60 * 1000);
    const tickInterval = setInterval(() => {
      const now = Date.now();
      setUpcomingEvents(prev =>
        prev.map(e => ({ ...e, minutesUntil: Math.round((e.date.getTime() - now) / 60000) }))
      );
      setTomorrowEvents(prev =>
        prev.map(e => ({ ...e, minutesUntil: Math.round((e.date.getTime() - now) / 60000) }))
      );
    }, 60 * 1000);

    return () => {
      clearInterval(newsInterval);
      clearInterval(tickInterval);
    };
  }, [fetchNews]);

  const imminentHigh = upcomingEvents.filter(
    e => e.minutesUntil >= -10 && e.minutesUntil <= 60 && e.impact === 'High'
  );

  const todayImminent = upcomingEvents.filter(e => e.minutesUntil >= -10 && e.minutesUntil <= 120);
  const todayLater = upcomingEvents.filter(e => e.minutesUntil > 120);

  return (
    <div className={`news-feed-container ${alertLevel}`}>
      {/* Header */}
      <div className="news-feed-header">
        <div className="news-title">
          <Bell size={14} />
          <span>Economic Events</span>
        </div>
        <div className="news-status-row">
          {alertLevel === 'danger' && <span className="alert-dot danger" />}
          {alertLevel === 'warning' && <span className="alert-dot warning" />}
          {alertLevel === 'clear' && <CheckCircle size={11} className="clear-icon" />}
          <span className="news-last-updated">
            {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>
      </div>

      {/* Alert Banner */}
      {imminentHigh.length > 0 && (
        <div className={`news-alert-banner ${alertLevel}`}>
          <AlertTriangle size={13} className="alert-icon" />
          <span>
            <strong>HIGH IMPACT:</strong> {imminentHigh[0].title} ({imminentHigh[0].country})
            {' '}&mdash; {NewsFetcher.formatTimeUntil(imminentHigh[0].minutesUntil)}. Trade with caution!
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="news-tabs">
        <button
          className={`news-tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          <Clock size={10} />
          Today & Live
          {upcomingEvents.filter(e => e.impact === 'High' && e.minutesUntil > 0).length > 0 && (
            <span className="tab-count red">
              {upcomingEvents.filter(e => e.impact === 'High' && e.minutesUntil > 0).length}
            </span>
          )}
        </button>
        <button
          className={`news-tab ${activeTab === 'tomorrow' ? 'active' : ''}`}
          onClick={() => setActiveTab('tomorrow')}
        >
          <Calendar size={10} />
          Tomorrow
          {tomorrowEvents.filter(e => e.impact === 'High').length > 0 && (
            <span className="tab-count orange">
              {tomorrowEvents.filter(e => e.impact === 'High').length}
            </span>
          )}
        </button>
      </div>

      {/* TODAY Tab */}
      {activeTab === 'today' && (
        <div>
          {todayImminent.length > 0 && (
            <div className="news-section">
              <div className="news-section-label imminent-label">
                🔴 LIVE / IMMINENT (next 2hrs)
              </div>
              {todayImminent.map((event, i) => (
                <NewsCard key={`imm-${i}`} event={event} highlight />
              ))}
            </div>
          )}
          {todayLater.length > 0 && (
            <div className="news-section">
              <div className="news-section-label">📅 LATER TODAY</div>
              {todayLater.map((event, i) => (
                <NewsCard key={`lat-${i}`} event={event} highlight={false} />
              ))}
            </div>
          )}
          {upcomingEvents.length === 0 && (
            <div className="news-empty">✅ No high-impact events today. Market clear!</div>
          )}
        </div>
      )}

      {/* TOMORROW Tab */}
      {activeTab === 'tomorrow' && (
        <div>
          {tomorrowEvents.length === 0 ? (
            <div className="news-empty">No major events found for tomorrow.</div>
          ) : (
            <>
              <div className="tomorrow-summary">
                <span className="tmr-count red">🔴 {tomorrowEvents.filter(e => e.impact === 'High').length} High</span>
                <span className="tmr-count orange">🟠 {tomorrowEvents.filter(e => e.impact === 'Medium').length} Medium</span>
                <span className="tmr-count yellow">🟡 {tomorrowEvents.filter(e => e.impact === 'Low').length} Low</span>
              </div>
              <div className="news-section">
                {tomorrowEvents.map((event, i) => (
                  <NewsCard key={`tmr-${i}`} event={event} highlight={event.impact === 'High'} showDate />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const NewsCard: React.FC<{
  event: NewsEvent;
  highlight: boolean;
  showDate?: boolean;
}> = ({ event, highlight, showDate = false }) => {
  const flag = COUNTRY_FLAG[event.country] || '🌐';
  const timeStr = NewsFetcher.formatTimeUntil(event.minutesUntil);
  const isPast = event.minutesUntil < 0;
  const isHigh = event.impact === 'High';

  const timeDisplay = event.date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      className={`news-card ${isHigh ? 'high-impact' : event.impact === 'Medium' ? 'medium-impact' : 'low-impact'} ${highlight ? 'highlighted' : ''} ${isPast ? 'past' : ''}`}
    >
      <div className="news-card-left">
        <ImpactDots impact={event.impact} />
        <span className="news-flag">{flag}</span>
        <div className="news-card-info">
          <span className="news-event-title">{event.title}</span>
          <span className="news-event-meta">
            <span className="news-event-time">{timeDisplay}</span>
            {event.forecast && <span className="news-forecast">F: {event.forecast}</span>}
            {event.previous && <span className="news-previous">P: {event.previous}</span>}
          </span>
        </div>
      </div>
      <div className="news-card-right">
        <span className={`news-time-until ${isPast ? 'past' : isHigh ? 'high-c' : 'med-c'}`}>
          {showDate ? timeDisplay : timeStr}
        </span>
      </div>
    </div>
  );
};
