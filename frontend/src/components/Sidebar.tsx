'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, BarChart3, MessageSquare, FileText,
  Radar, Settings, Mail, ChevronRight
} from 'lucide-react';
import { gmailApi } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/assistant', icon: MessageSquare, label: 'AI Assistant' },
  { href: '/radar', icon: Radar, label: 'Opportunity Radar' },
  { href: '/resumes', icon: FileText, label: 'Resume Hub' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [gmailStatus, setGmailStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    gmailApi.status()
      .then(res => setGmailStatus(res.data.authenticated ? 'connected' : 'disconnected'))
      .catch(() => setGmailStatus('disconnected'));
  }, []);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">CareerNode</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item ${pathname === href ? 'active' : ''}`}
          >
            <Icon size={16} className="nav-item-icon" />
            {label}
            {pathname === href && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </Link>
        ))}

        <div className="nav-section-label" style={{ marginTop: '16px' }}>Integrations</div>
        <Link href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
          <Mail size={16} className="nav-item-icon" />
          Gmail Setup
        </Link>
        <Link href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
          <Settings size={16} className="nav-item-icon" />
          Settings
        </Link>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="gmail-status">
          <div className={`status-dot ${gmailStatus}`} />
          <span>
            Gmail: {gmailStatus === 'checking' ? 'Checking...' : gmailStatus === 'connected' ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>
    </aside>
  );
}
