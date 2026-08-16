import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const ACCENT = "#9a3412";
const ACCENT_STRONG = "#d2521a";
const GOLD = "#c2922a";
const ACCENT_GREEN = "#2a4d3a";
const PALETTE = [ACCENT_STRONG, ACCENT, GOLD, ACCENT_GREEN, "#84624f"];

const TooltipBox = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="analytics-tooltip">
      {label ? <strong>{label}</strong> : null}
      {payload.map((p) => (
        <span key={p.name}>
          {p.name}: <b>{p.value}</b>
        </span>
      ))}
    </div>
  );
};

const StatTile = ({ label, value, glyph }) => (
  <div className="analytics-stat">
    <span className="analytics-stat-glyph" aria-hidden="true">
      {glyph}
    </span>
    <span className="analytics-stat-num">{value}</span>
    <span className="analytics-stat-label">{label}</span>
  </div>
);

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const [totals, setTotals] = useState({ totalViews: 0, totalSaves: 0, totalReactions: 0 });
  const [events, setEvents] = useState({});
  const [posts, setPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [selectedPostAnalytics, setSelectedPostAnalytics] = useState(null);
  const [selectedPostEvents, setSelectedPostEvents] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;

      try {
        const [analyticsRes, postsRes] = await Promise.all([
          api.get(`/users/${user.id}/analytics`),
          api.get(`/users/${user.id}/posts`, { params: { limit: 100 } }),
        ]);

        setTotals(analyticsRes.data.totals || {});
        setEvents(analyticsRes.data.eventBreakdown || {});
        const rows = postsRes.data.posts || [];
        setPosts(rows);
        if (rows.length > 0) {
          setSelectedPostId(rows[0]._id);
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load analytics");
      }
    };

    load();
  }, [user?.id]);

  useEffect(() => {
    const loadPostAnalytics = async () => {
      if (!selectedPostId) {
        setSelectedPostAnalytics(null);
        return;
      }

      try {
        const { data } = await api.get(`/posts/${selectedPostId}/analytics`);
        const analytics = data.analytics || null;
        setSelectedPostAnalytics(analytics);
        setSelectedPostEvents(analytics?.events || {});
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load post analytics");
      }
    };

    loadPostAnalytics();
  }, [selectedPostId]);

  const totalsData = useMemo(
    () => [
      { name: "Views", value: totals.totalViews || 0 },
      { name: "Saves", value: totals.totalSaves || 0 },
      { name: "Reactions", value: totals.totalReactions || 0 },
    ],
    [totals]
  );

  const eventData = useMemo(
    () => Object.entries(events).map(([name, count]) => ({ name, count })),
    [events]
  );

  const selectedPostChartData = useMemo(
    () =>
      selectedPostAnalytics
        ? [
            { name: "Views", value: Number(selectedPostAnalytics.views) || 0 },
            { name: "Saves", value: Number(selectedPostAnalytics.saves) || 0 },
            { name: "Reactions", value: Number(selectedPostAnalytics.reactions) || 0 },
            { name: "Comments", value: Number(selectedPostAnalytics.comments) || 0 },
          ]
        : [],
    [selectedPostAnalytics]
  );

  const selectedEventData = useMemo(
    () => Object.entries(selectedPostEvents).map(([name, count]) => ({ name, count })),
    [selectedPostEvents]
  );

  const hasAnyData =
    (totals.totalViews || 0) + (totals.totalSaves || 0) + (totals.totalReactions || 0) > 0;

  return (
    <section className="analytics-page">
      <header className="library-hero analytics-hero">
        <span className="auth-eyebrow">Behind the page</span>
        <h1 className="library-title">Analytics</h1>
        <p className="library-sub">
          See how your archive travels — who's reading, who's saving, what's striking a chord.
        </p>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="analytics-stat-grid">
        <StatTile label="Total reads" value={totals.totalViews || 0} glyph="📖" />
        <StatTile label="Saves" value={totals.totalSaves || 0} glyph="✦" />
        <StatTile label="Reactions" value={totals.totalReactions || 0} glyph="❤" />
        <StatTile label="Notes" value={posts.length} glyph="✒" />
      </div>

      <div className="chart-grid analytics-chart-grid">
        <div className="panel analytics-chart-panel">
          <h3 className="side-title">Totals breakdown</h3>
          {hasAnyData ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={totalsData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={92}
                  innerRadius={48}
                  paddingAngle={2}
                  stroke="none"
                >
                  {totalsData.map((entry, index) => (
                    <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipBox />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">No data yet — share a note to start the count.</p>
          )}
        </div>

        <div className="panel analytics-chart-panel">
          <h3 className="side-title">Event activity</h3>
          {eventData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={eventData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(154,52,18,0.12)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#7a6a5a" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#7a6a5a" fontSize={12} />
                <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(154,52,18,0.06)" }} />
                <Bar dataKey="count" fill={ACCENT_STRONG} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">No events tracked yet.</p>
          )}
        </div>
      </div>

      <div className="panel analytics-perpost">
        <div className="row-between analytics-perpost-head">
          <h3 className="side-title">Per-note analytics</h3>
          {posts.length > 0 && (
            <select
              value={selectedPostId}
              onChange={(e) => setSelectedPostId(e.target.value)}
              className="analytics-post-select"
            >
              {posts.map((p) => (
                <option key={p._id} value={p._id}>
                  {(p.content || "Untitled").slice(0, 60)}
                </option>
              ))}
            </select>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="empty-state">
            <h3>No notes to analyze yet</h3>
            <p>Publish a note and its numbers will appear here.</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={selectedPostChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(154,52,18,0.12)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#7a6a5a" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#7a6a5a" fontSize={12} />
                <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(154,52,18,0.06)" }} />
                <Bar dataKey="value" fill={ACCENT} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {selectedPostAnalytics ? (
              <div className="analytics-rate">
                <span className="analytics-rate-label">Engagement rate</span>
                <span className="analytics-rate-value">
                  {selectedPostAnalytics.engagementRate || 0}%
                </span>
              </div>
            ) : null}

            {selectedEventData.length > 0 ? (
              <div className="analytics-events">
                <h4 className="side-title">Event mix</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={selectedEventData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="rgba(154,52,18,0.12)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#7a6a5a" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="#7a6a5a" fontSize={12} />
                    <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(154,52,18,0.06)" }} />
                    <Bar dataKey="count" fill={GOLD} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};

export default AnalyticsDashboard;
