'use client';

import { useEffect, useState } from 'react';
import { Plus, ExternalLink, Trash2, ArrowRight, Filter } from 'lucide-react';
import { radarApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { format } from 'date-fns';

const STATUSES = ['unreviewed', 'saved', 'dismissed', 'applied'];

const STATUS_COLORS: Record<string, string> = {
  unreviewed: 'var(--status-applied)',
  saved: 'var(--status-interview)',
  dismissed: 'var(--status-ghosted)',
  applied: 'var(--status-offer)',
};

export default function RadarPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('unreviewed');

  const load = async () => {
    setLoading(true);
    try {
      const res = await radarApi.list({ status: statusFilter });
      setItems(res.data);
    } catch {
      toast('Failed to load radar', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await radarApi.updateStatus(id, status);
      toast(`Marked as ${status}`, 'success');
      load();
    } catch {
      toast('Update failed', 'error');
    }
  };

  const convert = async (id: string) => {
    try {
      await radarApi.convert(id);
      toast('✅ Added to your tracked applications!', 'success');
      load();
    } catch {
      toast('Conversion failed', 'error');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this lead?')) return;
    try {
      await radarApi.delete(id);
      load();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Opportunity Radar</h1>
          <p className="page-subtitle">Job leads auto-extracted from your email alerts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        {STATUSES.map(s => (
          <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)} style={{ textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
        <button className={`filter-chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
      </div>

      {/* Leads Grid */}
      {loading ? (
        <div className="grid-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card skeleton" style={{ height: 200 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <div className="empty-state-title">No leads in Radar</div>
          <div className="empty-state-text">
            Sync your Gmail to automatically extract job leads from Indeed, LinkedIn, and Glassdoor alert emails.
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {items.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {item.platform && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {item.platform}
                    </span>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginTop: 2 }}>
                    {item.job_title || 'Unknown Role'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.company || 'Unknown Company'}</div>
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[item.status] || 'var(--text-muted)', marginTop: 4, flexShrink: 0, boxShadow: `0 0 6px ${STATUS_COLORS[item.status]}` }} />
              </div>

              {/* Snippet */}
              {item.description_snippet && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.description_snippet}
                </p>
              )}

              {/* Date */}
              {item.email_date && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  📅 {format(new Date(item.email_date), 'MMM d, yyyy')}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
                {item.apply_link && (
                  <a href={item.apply_link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    <ExternalLink size={12} /> Apply
                  </a>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => convert(item.id)} title="Track this as an application">
                  <ArrowRight size={12} /> Track
                </button>
                {item.status !== 'saved' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(item.id, 'saved')}>Save</button>
                )}
                {item.status !== 'dismissed' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(item.id, 'dismissed')}>Dismiss</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => remove(item.id)} style={{ color: 'var(--status-rejected)', marginLeft: 'auto' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
