import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { fetchInsights } from './api';
import './InsightsPanel.css';

function renderBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

function InsightsPanel({ filters }) {
  const [bullets, setBullets] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchInsights(filters)
      .then((data) => {
        setBullets(data.bullets || []);
        setGeneratedAt(data.generated_at);
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail
          || 'Could not generate insights. Is the backend configured with Azure OpenAI credentials?';
        setError(detail);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [JSON.stringify(filters)]);

  const dateLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="card insights-panel">
      <div className="insights-header">
        <div>
          <h3 className="chart-title">Executive Brief</h3>
          {dateLabel && <span className="insights-date">{dateLabel}</span>}
        </div>
        <div className="insights-header-actions">
          <span className="ai-badge"><Sparkles size={12} /> AI GENERATED</span>
          <button className="insights-refresh-btn" onClick={load} disabled={loading} aria-label="Regenerate insights">
            <RefreshCw size={14} className={loading ? 'insights-spin' : ''} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="insights-error">{error}</div>
      ) : loading ? (
        <div className="insights-loading">Generating insights...</div>
      ) : bullets.length === 0 ? (
        <div className="insights-loading">No insights available for this selection.</div>
      ) : (
        <ul className="insights-list">
          {bullets.map((b, idx) => <li key={idx}>{renderBold(b)}</li>)}
        </ul>
      )}
    </div>
  );
}

export default InsightsPanel;