'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

const STATUS_OPTIONS = [
  { value: 'Applied',            label: 'Applied' },
  { value: 'Assessment_Pending', label: '⏳ Assessment Pending' },
  { value: 'Assessment_Done',    label: '✅ Assessment Done' },
  { value: 'Interview_Pending',  label: '⏳ Interview Pending' },
  { value: 'Interview_Done',     label: '🎯 Interview Done' },
  { value: 'Offer',              label: '🏆 Offer' },
  { value: 'Rejected',           label: '❌ Rejected' },
  { value: 'Withdrawn',          label: 'Withdrawn' },
  { value: 'Ghosted',            label: 'Ghosted' },
];
const WORK_MODEL_OPTIONS = ['Remote', 'Hybrid', 'On-Site', 'Unknown'];
const ORIGIN_OPTIONS = ['Domestic', 'International', 'Unknown'];

interface Props {
  job?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function JobModal({ job, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company: '',
    role: '',
    status: 'Applied',
    date_applied: new Date().toISOString().split('T')[0],
    job_description: '',
    location: '',
    work_model: 'Unknown',
    company_origin: 'Unknown',
    platform: '',
    apply_link: '',
    notes: '',
    tech_tags: [] as string[],
  });
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (job) {
      setForm({
        company: job.company || '',
        role: job.role || '',
        status: job.status || 'Applied',
        date_applied: job.date_applied ? new Date(job.date_applied).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        job_description: job.job_description || '',
        location: job.location || '',
        work_model: job.work_model || 'Unknown',
        company_origin: job.company_origin || 'Unknown',
        platform: job.platform || '',
        apply_link: job.apply_link || '',
        notes: job.notes || '',
        tech_tags: job.tech_tags || [],
      });
    }
  }, [job]);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !form.tech_tags.includes(tag)) {
      set('tech_tags', [...form.tech_tags, tag]);
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => set('tech_tags', form.tech_tags.filter(t => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company || !form.role) {
      toast('Company and Role are required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (job?.id) {
        await jobsApi.update(job.id, form);
        toast('Application updated!', 'success');
      } else {
        await jobsApi.create(form);
        toast('Application added!', 'success');
      }
      onSaved();
      onClose();
    } catch {
      toast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{job ? 'Edit Application' : 'Add New Application'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Company *</label>
                <input id="job-company" className="form-input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="e.g. Google" required />
              </div>
              <div className="form-group">
                <label className="form-label">Role / Job Title *</label>
                <input id="job-role" className="form-input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Software Engineer" required />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select id="job-status" className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date Applied</label>
                <input id="job-date" className="form-input" type="date" value={form.date_applied} onChange={e => set('date_applied', e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Work Model</label>
                <select id="job-work-model" className="form-select" value={form.work_model} onChange={e => set('work_model', e.target.value)}>
                  {WORK_MODEL_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Company Origin</label>
                <select id="job-origin" className="form-select" value={form.company_origin} onChange={e => set('company_origin', e.target.value)}>
                  {ORIGIN_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Location</label>
                <input id="job-location" className="form-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Karachi / Remote" />
              </div>
              <div className="form-group">
                <label className="form-label">Platform</label>
                <input id="job-platform" className="form-input" value={form.platform} onChange={e => set('platform', e.target.value)} placeholder="e.g. LinkedIn, Indeed" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Apply Link</label>
              <input id="job-link" className="form-input" value={form.apply_link} onChange={e => set('apply_link', e.target.value)} placeholder="https://..." />
            </div>

            <div className="form-group">
              <label className="form-label">Job Description</label>
              <textarea id="job-description" className="form-textarea" value={form.job_description} onChange={e => set('job_description', e.target.value)} placeholder="Paste the full job description here — AI will auto-tag tech skills..." style={{ minHeight: 120 }} />
            </div>

            {/* Tech Tags */}
            <div className="form-group">
              <label className="form-label">Tech Tags</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {form.tech_tags.map(tag => (
                  <span key={tag} className="tech-tag" style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => removeTag(tag)}>
                    {tag} <X size={10} />
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="form-input" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Add tech tag..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={addTag}><Plus size={14} /></button>
              </div>
              <p className="text-xs text-muted mt-1">Tags are auto-generated from job description. You can add manually too.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea id="job-notes" className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any personal notes about this application..." style={{ minHeight: 80 }} />
            </div>

            {/* Status History (edit mode) */}
            {job?.status_history?.length > 0 && (
              <div className="form-group">
                <label className="form-label">Status History</label>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {job.status_history.map((h: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge badge-${h.status}`}>{h.status}</span>
                      <span className="text-xs text-muted">{h.date ? new Date(h.date).toLocaleDateString() : ''}</span>
                      <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>via {h.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="btn-save-job">
              {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : job ? 'Update' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
