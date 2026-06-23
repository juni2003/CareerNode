'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Code, ExternalLink, Github, X } from 'lucide-react';
import { resumesApi, projectsApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

const ROLE_CATEGORIES = ['AI/ML', 'Full-Stack', 'Backend', 'Frontend', 'Data Science', 'DevOps', 'Software Engineering', 'Mobile', 'Other'];

export default function ResumesPage() {
  const { toast } = useToast();
  const [resumes, setResumes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tab, setTab] = useState<'resumes' | 'projects'>('resumes');
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editResume, setEditResume] = useState<any>(null);
  const [editProject, setEditProject] = useState<any>(null);
  const [viewResume, setViewResume] = useState<any>(null);

  const loadResumes = async () => {
    try { setResumes((await resumesApi.list()).data); } catch {}
  };
  const loadProjects = async () => {
    try { setProjects((await projectsApi.list()).data); } catch {}
  };

  useEffect(() => { loadResumes(); loadProjects(); }, []);

  const deleteResume = async (id: string) => {
    if (!confirm('Delete this resume?')) return;
    try { await resumesApi.delete(id); toast('Resume deleted', 'success'); loadResumes(); } catch { toast('Delete failed', 'error'); }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    try { await projectsApi.delete(id); toast('Project deleted', 'success'); loadProjects(); } catch { toast('Delete failed', 'error'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Resume Hub</h1>
          <p className="page-subtitle">Manage your resume variants and project portfolio</p>
        </div>
        <div className="flex gap-2">
          {tab === 'resumes' ? (
            <button className="btn btn-primary" id="btn-add-resume" onClick={() => { setEditResume(null); setShowResumeModal(true); }}>
              <Plus size={15} /> Add Resume
            </button>
          ) : (
            <button className="btn btn-primary" id="btn-add-project" onClick={() => { setEditProject(null); setShowProjectModal(true); }}>
              <Plus size={15} /> Add Project
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="filters-bar" style={{ marginBottom: 24 }}>
        <button className={`filter-chip ${tab === 'resumes' ? 'active' : ''}`} onClick={() => setTab('resumes')}><FileText size={13} /> Resumes ({resumes.length})</button>
        <button className={`filter-chip ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}><Code size={13} /> Projects ({projects.length})</button>
      </div>

      {/* Resumes Tab */}
      {tab === 'resumes' && (
        resumes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-title">No resumes yet</div>
            <div className="empty-state-text">Add your resume variants so the AI can use them to generate tailored cover letters.</div>
            <button className="btn btn-primary" onClick={() => setShowResumeModal(true)}><Plus size={15} /> Add Resume</button>
          </div>
        ) : (
          <div className="grid-3">
            {resumes.map(r => (
              <div key={r.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setViewResume(r)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{r.name}</div>
                    <span className="badge" style={{ background: 'var(--accent-primary-glow)', color: 'var(--accent-secondary)', marginTop: 6 }}>{r.role_category}</span>
                  </div>
                  <FileText size={20} style={{ color: 'var(--accent-primary)', opacity: 0.6 }} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {r.content_markdown?.replace(/[#*`]/g, '') || ''}
                </p>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditResume(r); setShowResumeModal(true); }}><Pencil size={12} /> Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteResume(r.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Projects Tab */}
      {tab === 'projects' && (
        projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💻</div>
            <div className="empty-state-title">No projects yet</div>
            <div className="empty-state-text">Add your projects so the AI can reference them in cover letters.</div>
            <button className="btn btn-primary" onClick={() => setShowProjectModal(true)}><Plus size={15} /> Add Project</button>
          </div>
        ) : (
          <div className="grid-3">
            {projects.map(p => (
              <div key={p.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{p.title}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {p.github_link && <a href={p.github_link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><Github size={13} /></a>}
                    {p.live_link && <a href={p.live_link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13} /></a>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {(p.tech_stack || []).map((t: string) => <span key={t} className="tech-tag">{t}</span>)}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {p.description}
                </p>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditProject(p); setShowProjectModal(true); }}><Pencil size={12} /> Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteProject(p.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Resume Modal */}
      {showResumeModal && <ResumeModal resume={editResume} onClose={() => { setShowResumeModal(false); setEditResume(null); }} onSaved={loadResumes} />}

      {/* Project Modal */}
      {showProjectModal && <ProjectModal project={editProject} onClose={() => { setShowProjectModal(false); setEditProject(null); }} onSaved={loadProjects} />}

      {/* View Resume Modal */}
      {viewResume && (
        <div className="modal-overlay" onClick={() => setViewResume(null)}>
          <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{viewResume.name} — {viewResume.role_category}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewResume(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {viewResume.content_markdown}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resume Modal ─────────────────────────────────────────────────────────────
function ResumeModal({ resume, onClose, onSaved }: any) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: resume?.name || '', role_category: resume?.role_category || 'Software Engineering', content_markdown: resume?.content_markdown || '' });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.content_markdown) { toast('Name and content are required', 'error'); return; }
    setSaving(true);
    try {
      if (resume?.id) { await resumesApi.update(resume.id, form); toast('Resume updated!', 'success'); }
      else { await resumesApi.create(form); toast('Resume added!', 'success'); }
      onSaved(); onClose();
    } catch { toast('Save failed', 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <span className="modal-title">{resume ? 'Edit Resume' : 'Add Resume Variant'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Resume Name *</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. AI/ML Resume 2026" required />
              </div>
              <div className="form-group">
                <label className="form-label">Role Category</label>
                <select className="form-select" value={form.role_category} onChange={e => set('role_category', e.target.value)}>
                  {ROLE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Resume Content (Markdown / Plain Text) *</label>
              <textarea className="form-textarea" value={form.content_markdown} onChange={e => set('content_markdown', e.target.value)} placeholder="Paste your full resume here in plain text or markdown format..." style={{ minHeight: 320, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : resume ? 'Update' : 'Add Resume'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Project Modal ────────────────────────────────────────────────────────────
function ProjectModal({ project, onClose, onSaved }: any) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: project?.title || '',
    tech_stack: (project?.tech_stack || []).join(', '),
    github_link: project?.github_link || '',
    live_link: project?.live_link || '',
    description: project?.description || '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) { toast('Title and description are required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, tech_stack: form.tech_stack.split(',').map(t => t.trim()).filter(Boolean) };
    try {
      if (project?.id) { await projectsApi.update(project.id, payload); toast('Project updated!', 'success'); }
      else { await projectsApi.create(payload); toast('Project added!', 'success'); }
      onSaved(); onClose();
    } catch { toast('Save failed', 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{project ? 'Edit Project' : 'Add Project'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Project Title *</label><input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. CareerNode" required /></div>
            <div className="form-group"><label className="form-label">Tech Stack (comma-separated)</label><input className="form-input" value={form.tech_stack} onChange={e => set('tech_stack', e.target.value)} placeholder="Python, FastAPI, React, MongoDB" /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">GitHub Link</label><input className="form-input" value={form.github_link} onChange={e => set('github_link', e.target.value)} placeholder="https://github.com/..." /></div>
              <div className="form-group"><label className="form-label">Live Link</label><input className="form-input" value={form.live_link} onChange={e => set('live_link', e.target.value)} placeholder="https://..." /></div>
            </div>
            <div className="form-group"><label className="form-label">Description *</label><textarea className="form-textarea" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what the project does, your role, key features, and impact..." style={{ minHeight: 120 }} required /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : project ? 'Update' : 'Add Project'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
