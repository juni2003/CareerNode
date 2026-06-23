'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Search, RefreshCw, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { jobsApi, analyticsApi, gmailApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import JobModal from '@/components/JobModal';
import ActionNeededPanel from '@/components/ActionNeededPanel';
import { format } from 'date-fns';

// Status display helpers
const STATUS_ORDER = [
  'Applied', 'Assessment_Pending', 'Assessment_Done',
  'Interview_Pending', 'Interview_Done',
  'Offer', 'Rejected', 'Ghosted', 'Withdrawn',
];

const STATUS_LABELS: Record<string, string> = {
  Applied:             'Applied',
  Assessment_Pending:  '⏳ Assessment Pending',
  Assessment_Done:     '✅ Assessment Done',
  Interview_Pending:   '⏳ Interview Pending',
  Interview_Done:      '🎯 Interview Done',
  Offer:               'Offer',
  Rejected:            'Rejected',
  Ghosted:             'Ghosted',
  Withdrawn:           'Withdrawn',
  // Backwards compatibility mappings for UI
  Assessment:          '⏳ Assessment Pending',
  Interview:           '⏳ Interview Pending',
  Interview_Online:    '⏳ Interview Pending',
  Interview_Onsite:    '⏳ Interview Pending',
};

const PIPELINE_MAP: Record<string, number> = {
  Applied: 1, 
  Assessment: 2, Assessment_Pending: 2, Assessment_Done: 2,
  Interview: 3, Interview_Online: 3, Interview_Onsite: 3, Interview_Pending: 3, Interview_Done: 4,
  Offer: 5, Rejected: -1, Ghosted: -1, Withdrawn: -1,
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editJob, setEditJob] = useState<any>(null);
  const [sweeping, setSweeping] = useState(false);
  const startupToastFired = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, statsRes] = await Promise.all([
        jobsApi.list({ search: search || undefined, status: statusFilter || undefined }),
        analyticsApi.overview(),
      ]);
      setJobs(jobsRes.data);
      setStats(statsRes.data);
    } catch {
      toast('Failed to load data. Is the backend running?', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Startup reminder — fires once per session when action items exist
  const handleActionCount = useCallback((count: number) => {
    if (count > 0 && !startupToastFired.current && !sessionStorage.getItem('reminderShown')) {
      startupToastFired.current = true;
      sessionStorage.setItem('reminderShown', '1');
      toast(`📣 You have ${count} pending action${count > 1 ? 's' : ''} — check the Action Needed panel below!`, 'info');
    }
  }, [toast]);

  const handleSweep = async () => {
    setSweeping(true);
    try {
      toast('📬 Scanning emails... this takes ~2 mins. Don\'t close the tab!', 'info');
      const res = await gmailApi.sweep(2);
      const s = res.data.stats;
      toast(`✅ Sweep done! ${s.inserted} new jobs, ${s.updated} updated, ${s.radar} radar leads`, 'success');
      loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Sweep failed or timed out';
      toast(msg, 'error');
    } finally {
      setSweeping(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this application?')) return;
    try {
      await jobsApi.delete(id);
      toast('Application deleted', 'success');
      loadData();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  const handleEdit = (job: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditJob(job);
    setShowModal(true);
  };

  // Stats grid: single unified row, no duplicates
  const statCards = [
    { label: 'Total Applied',      value: stats.total || 0,                               icon: '📋' },
    { label: 'Assessment Pending', value: (stats.by_status?.Assessment || 0) + (stats.by_status?.Assessment_Pending || 0), icon: '⏳' },
    { label: 'Assessment Done',    value: stats.by_status?.Assessment_Done || 0,          icon: '✅' },
    { label: 'Interview Pending',  value: (stats.by_status?.Interview || 0) + (stats.by_status?.Interview_Online || 0) + (stats.by_status?.Interview_Onsite || 0) + (stats.by_status?.Interview_Pending || 0), icon: '⏳' },
    { label: 'Interview Done',     value: stats.by_status?.Interview_Done || 0,           icon: '⏳' },
    { label: 'Offers',             value: stats.offers || 0,                               icon: '🏆' },
    { label: 'Rejected',           value: stats.by_status?.Rejected || 0,                 icon: '❌' },
    { label: 'Conversion Rate',    value: `${stats.conversion_rate || 0}%`,               icon: '📈' },
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Tracker</h1>
          <p className="page-subtitle">Track and manage all your applications in one place</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleSweep} disabled={sweeping} id="btn-sweep-gmail">
            <RefreshCw size={15} className={sweeping ? 'spinning' : ''} />
            {sweeping ? 'Sweeping...' : 'Sync Gmail'}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditJob(null); setShowModal(true); }} id="btn-add-job">
            <Plus size={15} /> Add Application
          </button>
        </div>
      </div>

      {/* Unified Stat Cards — single row, no duplicates */}
      <div className="stat-grid">
        {statCards.map(({ label, value, icon }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-icon">{icon}</div>
          </div>
        ))}
      </div>

      {/* Action Needed Panel — shows pending Assessment/Interview items */}
      <ActionNeededPanel onCountChange={handleActionCount} onRefresh={loadData} />

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-bar">
          <Search size={15} className="search-bar-icon" />
          <input
            id="job-search"
            className="search-bar-input"
            placeholder="Search company, role, tech..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className={`filter-chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
        {STATUS_ORDER.map(s => (
          <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Role</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Tech Stack</th>
              <th>Platform</th>
              <th>Date Applied</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                  ))}
                </tr>
              ))
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <div className="empty-state-title">No applications yet</div>
                    <div className="empty-state-text">Add your first application manually or sync your Gmail to import automatically.</div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                      <Plus size={15} /> Add Application
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} onClick={() => { setEditJob(job); setShowModal(true); }}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {job.company}
                      {job.needs_review && (
                        <span title="Missing company or role — needs review" style={{ color: '#f59e0b', fontSize: '0.7rem' }}>⚠️</span>
                      )}
                    </div>
                    {job.location && <div className="text-xs text-muted">{job.location}</div>}
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div className="truncate" title={job.role}>{job.role}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${job.status?.replace('_', '-')}`}>
                      {STATUS_LABELS[job.status] || job.status}
                    </span>
                  </td>
                  <td style={{ minWidth: 100 }}>
                    <div className="pipeline">
                      {[1, 2, 3, 4, 5].map(step => (
                        <div
                          key={step}
                          className={`pipeline-step ${
                            PIPELINE_MAP[job.status] === -1 ? 'failed' :
                            PIPELINE_MAP[job.status] >= step ? 'active' : ''
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
                      {(job.tech_tags || []).slice(0, 4).map((tag: string) => (
                        <span key={tag} className="tech-tag">{tag}</span>
                      ))}
                      {(job.tech_tags || []).length > 4 && (
                        <span className="tech-tag">+{job.tech_tags.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="text-sm text-muted">{job.platform || '—'}</td>
                  <td className="text-sm text-muted">
                    {job.date_applied ? format(new Date(job.date_applied), 'MMM d, yyyy') : '—'}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {job.apply_link && (
                        <a href={job.apply_link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" title="Open job link">
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={e => handleEdit(job, e)} title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={e => handleDelete(job.id, e)} title="Delete" style={{ color: 'var(--status-rejected)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Job Modal */}
      {showModal && (
        <JobModal
          job={editJob}
          onClose={() => { setShowModal(false); setEditJob(null); }}
          onSaved={loadData}
        />
      )}

      <style jsx>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
