'use client';

import { useEffect, useState } from 'react';
import { Mail, Key, RefreshCw, CheckCircle, AlertCircle, ExternalLink, Trash2 } from 'lucide-react';
import { gmailApi, jobsApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

export default function SettingsPage() {
  const { toast } = useToast();
  const [gmailStatus, setGmailStatus] = useState<any>(null);
  const [sweeping, setSweeping] = useState(false);
  const [authing, setAuthing] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const checkStatus = async () => {
    try {
      const res = await gmailApi.status();
      setGmailStatus(res.data);
    } catch {
      setGmailStatus({ configured: false, connected: false });
    }
  };

  useEffect(() => { checkStatus(); }, []);

  const handleAuth = async () => {
    setAuthing(true);
    try {
      await gmailApi.auth();
      toast('Gmail authenticated successfully!', 'success');
      checkStatus();
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Auth failed', 'error');
    } finally {
      setAuthing(false);
    }
  };

  const handleSweep = async () => {
    setSweeping(true);
    try {
      toast('📬 Scanning emails... this takes ~2 mins. Don\'t close the tab!', 'info');
      const res = await gmailApi.sweep(2);
      const s = res.data.stats;
      toast(`✅ Sweep done! ${s.inserted} new jobs, ${s.updated} updated, ${s.radar} radar leads`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.detail || e?.message || 'Sweep failed or timed out', 'error');
    } finally {
      setSweeping(false);
    }
  };

  const handleWipeData = async () => {
    if (!confirm('🚨 WARNING: This will permanently delete ALL job applications, radar leads, and chat history. Are you sure?')) return;
    if (!confirm('Are you ABSOLUTELY sure? This cannot be undone.')) return;
    
    try {
      await jobsApi.wipeAll();
      toast('Database wiped clean. Starting fresh.', 'success');
    } catch (e) {
      toast('Failed to wipe data', 'error');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure integrations and app preferences</p>
        </div>
      </div>

      <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Gmail Integration */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: 'rgba(234, 67, 53, 0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={18} style={{ color: '#ea4335' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Gmail Integration</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-import job application emails</div>
              </div>
            </div>
            {gmailStatus?.connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-offer)', fontSize: 13, fontWeight: 500 }}>
                <CheckCircle size={16} /> Connected ✓
              </div>
            ) : gmailStatus?.configured ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-assessment)', fontSize: 13, fontWeight: 500 }}>
                <AlertCircle size={16} /> Config error
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                <AlertCircle size={16} /> Not configured
              </div>
            )}
          </div>

        {!gmailStatus?.configured && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: 8 }}>⚡ Quick Setup — Takes 2 minutes!</div>
              <ol style={{ paddingLeft: 16, color: 'var(--text-secondary)', lineHeight: 2.2 }}>
                <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">myaccount.google.com/security <ExternalLink size={11} style={{ verticalAlign: 'middle' }} /></a></li>
                <li>Make sure <strong>2-Step Verification</strong> is ON</li>
                <li>Also enable <strong>IMAP</strong> in Gmail → Settings → See all settings → Forwarding and POP/IMAP</li>
                <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">myaccount.google.com/apppasswords <ExternalLink size={11} style={{ verticalAlign: 'middle' }} /></a></li>
                <li>App name: <code style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 3 }}>CareerNode</code> → Click <strong>Create</strong></li>
                <li>Copy the 16-character password shown</li>
                <li>Open <code style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 3 }}>backend/.env</code> and set:<br/>
                  <code style={{ background: 'var(--bg-base)', padding: '4px 8px', borderRadius: 3, display: 'block', marginTop: 4 }}>GMAIL_EMAIL=you@gmail.com</code>
                  <code style={{ background: 'var(--bg-base)', padding: '4px 8px', borderRadius: 3, display: 'block', marginTop: 4 }}>GMAIL_APP_PASSWORD=abcdefghijklmnop</code>
                </li>
                <li>Restart the backend server, then click <strong>Sync Now</strong> above</li>
              </ol>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {gmailStatus?.connected && (
              <button className="btn btn-primary" onClick={handleSweep} disabled={sweeping} id="btn-manual-sweep">
                <RefreshCw size={15} className={sweeping ? 'spinning' : ''} />
                {sweeping ? 'Sweeping emails...' : 'Sync Now (last 2 months)'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={checkStatus} id="btn-check-status">
              <RefreshCw size={14} /> Recheck Status
            </button>
          </div>
        </div>

        {/* Gemini API Key */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: 'var(--accent-primary-glow)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={18} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Gemini AI</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Powers the AI assistant (free tier)</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
            <p>The Gemini API key is configured in your <code style={{ background: 'var(--bg-base)', padding: '1px 5px', borderRadius: 3 }}>backend/.env</code> file.</p>
            <p style={{ marginTop: 6 }}>Get a free key at: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com <ExternalLink size={11} style={{ verticalAlign: 'middle' }} /></a></p>
            <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>Free tier: 1,500 requests/day, 60 req/min — plenty for personal use.</p>
          </div>
          <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--accent-secondary)' }}>
            GEMINI_API_KEY=your_key_here
          </div>
        </div>

        {/* MongoDB Info */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: 'rgba(16, 185, 129, 0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 18 }}>🍃</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>MongoDB (Local)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>v8.0 — all data stored locally on your machine</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-offer)', fontSize: 13, fontWeight: 500 }}>
              <CheckCircle size={16} /> Local
            </div>
          </div>
          <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
            <div>URI: <span style={{ color: 'var(--accent-secondary)' }}>mongodb://localhost:27017</span></div>
            <div>DB: <span style={{ color: 'var(--accent-secondary)' }}>careernode</span></div>
            <div style={{ marginTop: 4 }}>Data path: <span style={{ color: 'var(--text-muted)' }}>%USERPROFILE%\data\db</span></div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--status-rejected)' }}>Danger Zone</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Irreversible actions</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400 }}>
              Permanently delete all scraped job applications and radar leads. Use this to start fresh.
            </div>
            <button className="btn btn-danger" onClick={handleWipeData} id="btn-wipe-data">
              <Trash2 size={14} /> Wipe All Data
            </button>
          </div>
        </div>

      </div>

      <style jsx>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
