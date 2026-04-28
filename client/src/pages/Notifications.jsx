import React, { useEffect, useState } from 'react';
import { notificationsAPI, whatsapp as wa } from '../utils/api';
import { useToast } from '../context/ToastContext';

const TYPE_ICON = { due_reminder: '💰', expiry_alert: '⏰', overdue: '🚨', payment_received: '✅', new_member: '👤', member_left: '🚪', system: 'ℹ️' };
const PRIORITY_COLOR = { high: 'var(--danger)', medium: 'var(--accent)', low: 'var(--text3)' };

export default function Notifications() {
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationsAPI.getAll();
      setData(res.data);
    } catch(e) { toast('Error loading notifications', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await notificationsAPI.markRead(id);
    setData(p => ({ ...p, notifications: p.notifications.map(n => n._id === id ? { ...n, isRead: true } : n), unreadCount: Math.max(0, p.unreadCount - 1) }));
  };

  const markAllRead = async () => {
    await notificationsAPI.markAllRead();
    setData(p => ({ ...p, notifications: p.notifications.map(n => ({ ...n, isRead: true })), unreadCount: 0 }));
    toast('All marked as read');
  };

  const clearRead = async () => {
    await notificationsAPI.clearRead();
    toast('Read notifications cleared');
    load();
  };

  const filtered = data.notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'high') return n.priority === 'high';
    if (filter === 'overdue') return n.type === 'overdue';
    if (filter === 'payment') return n.type === 'payment_received';
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🔔 Notifications</h2>
          <p>{data.unreadCount} unread</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={markAllRead}>✓ Mark All Read</button>
          <button className="btn btn-secondary" onClick={clearRead}>🗑 Clear Read</button>
          <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: `Unread (${data.unreadCount})` },
          { key: 'high', label: '🚨 High Priority' },
          { key: 'overdue', label: '⚠️ Overdue' },
          { key: 'payment', label: '✅ Payments' },
        ].map(f => (
          <button key={f.key} className={`tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>⏳ Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🔔</div><p>No notifications</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filtered.map(n => (
              <div key={n._id} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: n.isRead ? 0.6 : 1, background: n.isRead ? 'transparent' : 'rgba(240,165,0,0.02)' }}>
                <div style={{ fontSize: '1.4rem', flexShrink: 0, width: 32, textAlign: 'center' }}>{TYPE_ICON[n.type] || '🔔'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>{n.title}</span>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLOR[n.priority], display: 'inline-block', flexShrink: 0 }} />
                    {!n.isRead && <span style={{ fontSize: '0.65rem', background: 'rgba(240,165,0,0.15)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 10, fontWeight: 700, fontFamily: 'Rajdhani' }}>NEW</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 4 }}>{n.message}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                    {new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {n.roomNumber && <span style={{ marginLeft: 8 }}>· Room {n.roomNumber}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0 }}>
                  {!n.isRead && (
                    <button onClick={() => markRead(n._id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', color: 'var(--text3)', fontSize: '0.72rem' }}>Read</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
