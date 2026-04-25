import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const [totals, setTotals] = useState({ totalViews: 0, totalSaves: 0, totalReactions: 0 });
  const [events, setEvents] = useState({});

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      const { data } = await api.get(`/users/${user.id}/analytics`);
      setTotals(data.totals || {});
      setEvents(data.eventBreakdown || {});
    };

    load();
  }, [user?.id]);

  return (
    <section>
      <h1>Analytics</h1>
      <div className="stats-grid">
        <article className="panel"><h3>Views</h3><p>{totals.totalViews || 0}</p></article>
        <article className="panel"><h3>Saves</h3><p>{totals.totalSaves || 0}</p></article>
        <article className="panel"><h3>Reactions</h3><p>{totals.totalReactions || 0}</p></article>
      </div>

      <div className="panel">
        <h3>Event Breakdown</h3>
        {Object.entries(events).map(([name, count]) => (
          <p key={name}>{name}: {count}</p>
        ))}
      </div>
    </section>
  );
};

export default AnalyticsDashboard;
