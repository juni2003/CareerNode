'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Plus, Trash2, Bot, User, Sparkles, FileText, Briefcase } from 'lucide-react';
import { aiApi, jobsApi, resumesApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import ReactMarkdown from 'react-markdown';

export default function AssistantPage() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedResume, setSelectedResume] = useState('');

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    loadSessions();
    jobsApi.list().then(r => setJobs(r.data)).catch(() => {});
    resumesApi.list().then(r => setResumes(r.data)).catch(() => {});
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadSessions = async () => {
    try {
      const res = await aiApi.listSessions();
      setSessions(res.data);
    } catch {}
  };

  const selectSession = async (session: any) => {
    setActiveSession(session);
    try {
      const res = await aiApi.getSession(session.session_id);
      setMessages(res.data.messages || []);
    } catch {}
  };

  const newSession = async () => {
    try {
      const res = await aiApi.createSession('New Chat');
      setSessions(prev => [res.data, ...prev]);
      setActiveSession(res.data);
      setMessages([]);
    } catch {
      toast('Failed to create session', 'error');
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await aiApi.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      if (activeSession?.session_id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || sending) return;
    const userMsg = input.trim();
    setInput('');
    setSending(true);

    // Optimistic UI
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date().toISOString() }]);

    try {
      const res = await aiApi.chat({
        session_id: activeSession.session_id,
        message: userMsg,
        job_id: selectedJob || undefined,
        resume_id: selectedResume || undefined,
      });
      setMessages(prev => [...prev, { role: 'model', content: res.data.reply, timestamp: new Date().toISOString() }]);
      // Update session title in sidebar
      loadSessions();
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Failed to get response', 'error');
      setMessages(prev => [...prev, { role: 'model', content: '❌ Sorry, I encountered an error. Please try again.', timestamp: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const QUICK_PROMPTS = [
    { label: '📋 Application Check', text: 'Did I apply to [Company] for [Role]?' },
    { label: '✉️ Cover Letter', text: 'Write me a tailored cover letter for this job.' },
    { label: '🎯 Interview Prep', text: 'Generate 5 technical interview questions for this role.' },
    { label: '📊 My Progress', text: 'Give me a summary of my job search progress.' },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)', overflow: 'hidden' }}>
      {/* Sessions Sidebar */}
      <div style={{ width: 260, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={newSession} id="btn-new-chat">
            <Plus size={15} /> New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
              <Bot size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              No chats yet
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.session_id}
                className={`chat-session-item ${activeSession?.session_id === session.session_id ? 'active' : ''}`}
                onClick={() => selectSession(session)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="chat-session-title" style={{ flex: 1 }}>{session.title}</span>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: 0 }}
                    className="session-delete-btn"
                    onClick={e => deleteSession(session.session_id, e)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{session.message_count || 0} messages</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeSession ? (
          /* Welcome screen */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 32 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'var(--gradient-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: 'var(--shadow-glow)' }}>
                <Sparkles size={28} color="white" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>CareerNode AI</h2>
              <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>
                Your personal career coach. Ask me about your applications, generate cover letters, or prepare for interviews.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 500 }}>
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p.label}
                  style={{ padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 13, transition: 'all 0.2s', fontFamily: 'inherit' }}
                  onClick={async () => { await newSession(); setInput(p.text); }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" onClick={newSession}>
              <Plus size={16} /> Start a New Chat
            </button>
          </div>
        ) : (
          <>
            {/* Context selectors */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-surface)' }}>
              <Briefcase size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: 13, padding: '5px 28px 5px 10px' }}
                value={selectedJob}
                onChange={e => setSelectedJob(e.target.value)}
                id="context-job"
              >
                <option value="">No job context</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.company} — {j.role}</option>)}
              </select>
              <FileText size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: 13, padding: '5px 28px 5px 10px' }}
                value={selectedResume}
                onChange={e => setSelectedResume(e.target.value)}
                id="context-resume"
              >
                <option value="">Auto-select resume</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            {/* Messages */}
            <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px', fontSize: 14 }}>
                  Send a message to start chatting
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role}`} style={{ display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  <div className={`message-avatar ${msg.role === 'user' ? 'user' : 'ai'}`}>
                    {msg.role === 'user' ? <User size={14} /> : <Sparkles size={14} color="white" />}
                  </div>
                  <div className={`message-bubble`} style={{
                    maxWidth: '72%',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    border: msg.role === 'model' ? '1px solid var(--border-subtle)' : 'none',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    fontSize: 14,
                    lineHeight: 1.65,
                  }}>
                    {msg.role === 'model' ? (
                      <div className="markdown-body" style={{ fontSize: 14 }}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="chat-message model" style={{ display: 'flex', gap: 12 }}>
                  <div className="message-avatar ai"><Sparkles size={14} color="white" /></div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '16px', background: 'var(--bg-elevated)', borderRadius: '16px 16px 16px 4px', border: '1px solid var(--border-subtle)' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', animation: `bounce 1.2s infinite ${i * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            <div style={{ padding: '8px 20px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_PROMPTS.map(p => (
                <button key={p.label} onClick={() => setInput(p.text)} style={{ padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '999px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input area */}
            <div className="chat-input-area">
              <div className="chat-input-row">
                <textarea
                  ref={inputRef}
                  id="chat-input"
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything — cover letters, interview prep, application status..."
                  rows={1}
                  style={{ minHeight: 42 }}
                />
                <button className="chat-send-btn" onClick={sendMessage} disabled={!input.trim() || sending} id="btn-send-chat">
                  <Send size={16} />
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Press Enter to send, Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .session-delete-btn { transition: opacity 0.15s; }
        .chat-session-item:hover .session-delete-btn { opacity: 1 !important; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
