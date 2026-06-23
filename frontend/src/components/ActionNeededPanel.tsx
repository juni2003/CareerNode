'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Clock, ChevronDown, AlertTriangle } from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

// ─── What options appear when you click "Done" for each status ────────────────
// "No Answer Yet" options move OUT of Action Needed into their own category.
// Other options may keep the item in Action Needed (e.g. got an interview stage).
const DONE_OPTIONS: Record<string, { value: string; label: string; leavesPanel: boolean }[]> = {
  Assessment_Pending: [
    { value: 'Assessment_Done',  label: '✅ Assessment Done', leavesPanel: true  },
    { value: 'Interview_Pending',label: '⏳ Got Interview',    leavesPanel: false },
    { value: 'Offer',            label: '🏆 Got Offer',       leavesPanel: true  },
    { value: 'Rejected',         label: '❌ Rejected',        leavesPanel: true  },
  ],
  Interview_Pending: [
    { value: 'Interview_Done',   label: '🎯 Interview Done',  leavesPanel: true  },
    { value: 'Offer',            label: '🏆 Got Offer',       leavesPanel: true  },
    { value: 'Rejected',         label: '❌ Rejected',        leavesPanel: true  },
  ],
  // Mappings for old data
  Assessment: [
    { value: 'Assessment_Done',  label: '✅ Assessment Done', leavesPanel: true  },
    { value: 'Interview_Pending',label: '⏳ Got Interview',    leavesPanel: false },
    { value: 'Offer',            label: '🏆 Got Offer',       leavesPanel: true  },
    { value: 'Rejected',         label: '❌ Rejected',        leavesPanel: true  },
  ],
  Interview: [
    { value: 'Interview_Done',   label: '🎯 Interview Done',  leavesPanel: true  },
    { value: 'Offer',            label: '🏆 Got Offer',       leavesPanel: true  },
    { value: 'Rejected',         label: '❌ Rejected',        leavesPanel: true  },
  ],
  Interview_Online: [
    { value: 'Interview_Done',   label: '🎯 Interview Done',  leavesPanel: true  },
    { value: 'Offer',            label: '🏆 Got Offer',       leavesPanel: true  },
    { value: 'Rejected',         label: '❌ Rejected',        leavesPanel: true  },
  ],
  Interview_Onsite: [
    { value: 'Interview_Done',   label: '🎯 Interview Done',  leavesPanel: true  },
    { value: 'Offer',            label: '🏆 Got Offer',       leavesPanel: true  },
    { value: 'Rejected',         label: '❌ Rejected',        leavesPanel: true  },
  ],
};

const STATUS_DISPLAY: Record<string, { label: string; color: string; emoji: string }> = {
  Assessment_Pending: { label: 'Assessment Pending', color: '#f59e0b', emoji: '⏳' },
  Interview_Pending:  { label: 'Interview Pending',  color: '#8b5cf6', emoji: '⏳' },
  // Old data mapped visually
  Assessment:         { label: 'Assessment Pending', color: '#f59e0b', emoji: '⏳' },
  Interview:          { label: 'Interview Pending',  color: '#8b5cf6', emoji: '⏳' },
  Interview_Online:   { label: 'Interview Pending',  color: '#8b5cf6', emoji: '⏳' },
  Interview_Onsite:   { label: 'Interview Pending',  color: '#8b5cf6', emoji: '⏳' },
};

interface ActionItem {
  id: string;
  company: string;
  role: string;
  status: string;
  last_status_date: string | null;
  days_waiting: number;
  platform?: string;
}

interface Props {
  onCountChange?: (count: number) => void;
  onRefresh?: () => void;
}

export default function ActionNeededPanel({ onCountChange, onRefresh }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const res = await jobsApi.actionNeeded();
      const data: ActionItem[] = res.data;
      setItems(data);
      onCountChange?.(data.length);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleDone = async (
    itemId: string,
    newStatus: string,
    companyName: string,
    leavesPanel: boolean,
  ) => {
    setUpdatingId(itemId);
    setOpenDropdown(null);
    try {
      await jobsApi.update(itemId, { status: newStatus });

      // Human-friendly label for toast
      const labels: Record<string, string> = {
        Assessment_Done:  'Assessment Done — waiting for response',
        Interview_Done:   'Interview Done — waiting for response',
        Interview_Online: 'Online / AI Interview',
        Interview_Onsite: 'Final / Onsite Interview',
        Offer:            '🏆 Offer received!',
        Rejected:         'Rejected',
      };
      const label = labels[newStatus] || newStatus;

      if (leavesPanel) {
        toast(`✅ ${companyName} → "${label}" — removed from Action Needed`, 'success');
      } else {
        toast(`📋 ${companyName} → "${label}" — still in Action Needed`, 'info');
      }

      await loadItems();
      onRefresh?.();
    } catch {
      toast('Update failed', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStillGoing = async (itemId: string, companyName: string) => {
    setUpdatingId(itemId);
    try {
      await jobsApi.update(itemId, {
        notes: `Still in progress — noted on ${new Date().toLocaleDateString()}`,
      });
      toast(`⏳ ${companyName} — noted as still in progress`, 'info');
      await loadItems();
    } catch {
      toast('Update failed', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || items.length === 0) return null;

  return (
    <div className="action-panel">
      <div className="action-panel-header">
        <AlertTriangle size={16} className="action-panel-icon" />
        <span className="action-panel-title">Action Needed</span>
        <span className="action-panel-badge">{items.length}</span>
        <span className="action-panel-subtitle">
          — pending assessments &amp; interviews waiting for your update
        </span>
      </div>

      <div className="action-items-grid">
        {items.map((item) => {
          const statusMeta = STATUS_DISPLAY[item.status] || {
            label: item.status, color: '#6b7280', emoji: '📋',
          };
          const isUrgent = item.days_waiting >= 7;
          const isLoading = updatingId === item.id;
          const doneOptions = DONE_OPTIONS[item.status] || [];

          return (
            <div
              key={item.id}
              className={`action-item${isUrgent ? ' action-item-urgent' : ''}`}
            >
              {/* Status badge */}
              <div
                className="action-item-status"
                style={{ color: statusMeta.color, borderColor: `${statusMeta.color}55` }}
              >
                <span>{statusMeta.emoji}</span>
                <span>{statusMeta.label}</span>
              </div>

              {/* Company + Role */}
              <div className="action-item-info">
                <div className="action-item-company">{item.company}</div>
                <div className="action-item-role" title={item.role}>{item.role}</div>
              </div>

              {/* Time waiting */}
              <div className={`action-item-time${isUrgent ? ' action-item-time-urgent' : ''}`}>
                <Clock size={11} />
                <span>
                  {item.days_waiting === 0 ? 'Today'
                    : item.days_waiting === 1 ? '1 day ago'
                    : `${item.days_waiting} days ago`}
                </span>
                {isUrgent && <span className="action-urgent-tag">Overdue</span>}
              </div>

              {/* Action buttons */}
              <div className="action-item-buttons">
                {/* Done dropdown */}
                <div className="action-dropdown-wrapper">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() =>
                      setOpenDropdown(openDropdown === item.id ? null : item.id)
                    }
                    disabled={isLoading}
                    id={`btn-done-${item.id}`}
                  >
                    <CheckCircle2 size={13} />
                    Done
                    <ChevronDown size={11} />
                  </button>

                  {openDropdown === item.id && (
                    <div className="action-dropdown">
                      <div className="action-dropdown-label">What happened?</div>
                      {doneOptions.map((opt) => (
                        <button
                          key={opt.value}
                          className={`action-dropdown-item${opt.leavesPanel ? ' leaves-panel' : ''}`}
                          onClick={() =>
                            handleDone(item.id, opt.value, item.company, opt.leavesPanel)
                          }
                        >
                          {opt.label}
                          {opt.leavesPanel && (
                            <span className="action-dropdown-tag">leaves panel</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Still Going button */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleStillGoing(item.id, item.company)}
                  disabled={isLoading}
                  id={`btn-snooze-${item.id}`}
                >
                  <Clock size={13} />
                  Still Going
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Close dropdown on outside click */}
      {openDropdown && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10 }}
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </div>
  );
}
