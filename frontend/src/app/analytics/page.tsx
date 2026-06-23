'use client';

import { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, FunnelChart, Funnel,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
        {label && <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>}
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [volume, setVolume] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [workModel, setWorkModel] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [techTags, setTechTags] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.overview(),
      analyticsApi.volume(),
      analyticsApi.byRole(),
      analyticsApi.workModel(),
      analyticsApi.funnel(),
      analyticsApi.techTags(),
    ]).then(([ov, vol, rol, wm, fun, tags]) => {
      setOverview(ov.data);
      setVolume(vol.data);
      setRoles(rol.data);
      // Transform workModel data for stacked bar
      const wmMap: Record<string, any> = {};
      wm.data.forEach((d: any) => {
        if (!wmMap[d.work_model]) wmMap[d.work_model] = { work_model: d.work_model, Domestic: 0, International: 0, Unknown: 0 };
        wmMap[d.work_model][d.origin] = (wmMap[d.work_model][d.origin] || 0) + d.count;
      });
      setWorkModel(Object.values(wmMap));
      setFunnel(fun.data.map((d: any, i: number) => ({ ...d, fill: COLORS[i] })));
      setTechTags(tags.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><h1 className="page-title">Analytics</h1></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="chart-card skeleton" style={{ height: 320 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Visual insights into your job search journey</p>
        </div>
      </div>

      {/* Overview numbers */}
      <div className="stat-grid" style={{ marginBottom: 32 }}>
        {[
          { label: 'Total Applications', value: overview.total || 0 },
          { label: 'Interview Rate', value: `${overview.conversion_rate || 0}%` },
          { label: 'Active Pipelines', value: (overview.by_status?.Applied || 0) + (overview.by_status?.Interview || 0) + (overview.by_status?.Assessment || 0) },
          { label: 'Offers Received', value: overview.by_status?.Offer || 0 },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Application Volume */}
        <div className="chart-card">
          <div className="chart-title">📅 Application Volume (Weekly)</div>
          {volume.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">No data yet</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={volume}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="Applications" stroke="#6366f1" fill="url(#colorVolume)" strokeWidth={2} dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Role Distribution Pie */}
        <div className="chart-card">
          <div className="chart-title">🎯 Role Distribution</div>
          {roles.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🥧</div><div className="empty-state-title">No data yet</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={roles} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={90} innerRadius={40} paddingAngle={3}>
                  {roles.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} formatter={(val: number, name: string) => [val, name]} />
                <Legend formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Work Model Stacked Bar */}
        <div className="chart-card">
          <div className="chart-title">🌍 Work Model × Geography</div>
          {workModel.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🗺️</div><div className="empty-state-title">No data yet</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={workModel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="work_model" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(val: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{val}</span>} />
                <Bar dataKey="Domestic" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="International" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Unknown" stackId="a" fill="#475569" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="chart-card">
          <div className="chart-title">🔄 Application Funnel</div>
          {funnel.length === 0 || funnel.every(d => d.count === 0) ? (
            <div className="empty-state"><div className="empty-state-icon">📉</div><div className="empty-state-title">No data yet</div></div>
          ) : (
            <div style={{ padding: '20px 0' }}>
              {funnel.map((stage, i) => {
                const maxCount = funnel[0]?.count || 1;
                const pct = Math.round((stage.count / maxCount) * 100);
                return (
                  <div key={stage.stage} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{stage.stage}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{stage.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 32, background: 'var(--bg-elevated)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: COLORS[i % COLORS.length],
                        borderRadius: 6,
                        transition: 'width 0.8s ease',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 10,
                        fontSize: 12,
                        color: 'white',
                        fontWeight: 600,
                      }}>
                        {pct > 15 ? stage.count : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Tech Tags */}
      <div className="chart-card">
        <div className="chart-title">💻 Most Required Technologies</div>
        {techTags.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">🏷️</div><div className="empty-state-title">No tech tags yet</div></div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={techTags} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="tag" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Job Postings" radius={[0, 4, 4, 0]}>
                {techTags.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                <LabelList dataKey="count" position="right" style={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
