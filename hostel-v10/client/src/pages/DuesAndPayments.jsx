import React, { useEffect, useState, useCallback } from 'react';
import { membersAPI, receiptsAPI, whatsapp as wa } from '../utils/api';
import { useToast } from '../context/ToastContext';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtMoney = (n) => `₹${(n||0).toLocaleString('en-IN')}`;

export default function DuesAndPayments() {
  const [tab, setTab]                     = useState('dues');
  const [members, setMembers]             = useState([]);
  const [receipts, setReceipts]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      membersAPI.getAll({ limit: 500 }),
      receiptsAPI.getAll({ limit: 1000 }),
    ]).then(([mRes, rRes]) => {
      setMembers(mRes.data?.data || mRes.data || []);
      setReceipts(rRes.data?.data || rRes.data || []);
    }).catch(() => toast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date();

  // ── Overdue members (roomLeavingDate < today) ─────────────────────────────
  const overdueMembers = members.filter(m =>
    m.isActive !== false &&
    m.roomLeavingDate &&
    new Date(m.roomLeavingDate) < today
  ).sort((a, b) => new Date(a.roomLeavingDate) - new Date(b.roomLeavingDate));

  // ── Expiring soon (within 7 days) ────────────────────────────────────────
  const in7days = new Date(); in7days.setDate(today.getDate() + 7);
  const expiringSoon = members.filter(m =>
    m.isActive !== false &&
    m.roomLeavingDate &&
    new Date(m.roomLeavingDate) >= today &&
    new Date(m.roomLeavingDate) <= in7days
  ).sort((a, b) => new Date(a.roomLeavingDate) - new Date(b.roomLeavingDate));

  // ── Part payments (outstanding balance) ───────────────────────────────────
  const partPayments = receipts
    .filter(r => r.isPartPayment && (r.balanceDue || 0) > 0)
    .sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0));

  const totalBalanceDue = partPayments.reduce((s, r) => s + (r.balanceDue || 0), 0);

  // ── Filter by search ──────────────────────────────────────────────────────
  const filterSearch = (list, nameKey = 'name') => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(item =>
      (item[nameKey] || '').toLowerCase().includes(q) ||
      String(item.roomNumber || '').includes(q) ||
      (item.mobileNo || item.memberMobile || '').includes(q)
    );
  };

  if (loading) return <div style={{ color:'var(--text2)', padding:40 }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dues & Payments</h2>
          <p>
            <span style={{ color:'var(--danger)', fontWeight:600 }}>{overdueMembers.length} overdue</span>
            {' · '}
            <span style={{ color:'var(--accent)', fontWeight:600 }}>{expiringSoon.length} expiring soon</span>
            {' · '}
            <span style={{ color:'#9b59b6', fontWeight:600 }}>{partPayments.length} part payments · {fmtMoney(totalBalanceDue)} pending</span>
          </p>
        </div>
        <input
          style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 14px', color:'var(--text)', outline:'none', fontSize:'0.88rem', width:220 }}
          placeholder="🔍 Name / room / mobile..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Overdue Members',    value:overdueMembers.length,  color:'var(--danger)',  icon:'⚠️',  tab:'dues'     },
          { label:'Expiring in 7 Days', value:expiringSoon.length,    color:'var(--accent)',  icon:'⏰',  tab:'expiring' },
          { label:'Part Payments',       value:partPayments.length,    color:'#9b59b6',        icon:'💳',  tab:'partpay'  },
          { label:'Total Balance Due',   value:fmtMoney(totalBalanceDue), color:'var(--danger)', icon:'💰', tab:'partpay' },
        ].map((c, i) => (
          <div key={i} className="card" style={{ cursor:'pointer', borderColor: tab === c.tab ? c.color : 'var(--border)', transition:'border-color 0.2s' }}
            onClick={() => setTab(c.tab)}>
            <div style={{ fontSize:'0.68rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>{c.icon} {c.label}</div>
            <div style={{ fontFamily:'Rajdhani', fontSize:'1.5rem', fontWeight:700, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom:16 }}>
        <button className={`tab ${tab==='dues'?'active':''}`}     onClick={()=>setTab('dues')}>
          ⚠️ Overdue ({overdueMembers.length})
        </button>
        <button className={`tab ${tab==='expiring'?'active':''}`} onClick={()=>setTab('expiring')}>
          ⏰ Expiring Soon ({expiringSoon.length})
        </button>
        <button className={`tab ${tab==='partpay'?'active':''}`}  onClick={()=>setTab('partpay')}>
          💳 Part Payments ({partPayments.length})
        </button>
      </div>

      {/* ── OVERDUE TAB ─────────────────────────────────────────────────── */}
      {tab === 'dues' && (
        <div className="card">
          <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(231,76,60,0.06)', borderRadius:6, fontSize:'0.83rem', color:'var(--text2)' }}>
            ⚠️ These members' plans have expired. Make a new receipt with updated "To Period" to clear them, or vacate them from Room Details.
          </div>
          {filterSearch(overdueMembers).length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><p>No overdue members{search ? ' matching search' : ''}</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Member</th><th>Room</th><th>Mobile</th><th>Plan Expired</th><th>Days Overdue</th><th>Rent</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filterSearch(overdueMembers).map(m => {
                    const daysOver = Math.floor((today - new Date(m.roomLeavingDate)) / (1000*60*60*24));
                    return (
                      <tr key={m._id}>
                        <td style={{ color:'var(--text)', fontWeight:600 }}>{m.name}</td>
                        <td>{m.roomNumber ? <span className="badge badge-blue">Room {m.roomNumber}</span> : '—'}</td>
                        <td style={{ fontSize:'0.82rem' }}>{m.mobileNo || '—'}</td>
                        <td style={{ color:'var(--danger)' }}>{fmt(m.roomLeavingDate)}</td>
                        <td>
                          <span style={{ background:'rgba(231,76,60,0.12)', color:'var(--danger)', padding:'2px 10px', borderRadius:10, fontWeight:700, fontSize:'0.8rem' }}>
                            {daysOver} day{daysOver!==1?'s':''} ago
                          </span>
                        </td>
                        <td>{m.rent ? fmtMoney(m.rent) : '—'}</td>
                        <td>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            {m.mobileNo && (
                              <button
                                style={{ background:'#25d366', color:'white', border:'none', borderRadius:5, padding:'5px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:700 }}
                                onClick={() => wa.sendReminder(m.mobileNo, m.name, m.roomNumber, m.rent || 0, 'rent dues')}
                              >📱 WhatsApp</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── EXPIRING SOON TAB ───────────────────────────────────────────── */}
      {tab === 'expiring' && (
        <div className="card">
          <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(240,165,0,0.06)', borderRadius:6, fontSize:'0.83rem', color:'var(--text2)' }}>
            ⏰ These members' plans expire within 7 days. Send a renewal reminder or generate a new receipt to extend their plan.
          </div>
          {filterSearch(expiringSoon).length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><p>No members expiring soon{search ? ' matching search' : ''}</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Member</th><th>Room</th><th>Mobile</th><th>Plan Expires</th><th>Days Left</th><th>Rent</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filterSearch(expiringSoon).map(m => {
                    const daysLeft = Math.ceil((new Date(m.roomLeavingDate) - today) / (1000*60*60*24));
                    return (
                      <tr key={m._id}>
                        <td style={{ color:'var(--text)', fontWeight:600 }}>{m.name}</td>
                        <td>{m.roomNumber ? <span className="badge badge-blue">Room {m.roomNumber}</span> : '—'}</td>
                        <td style={{ fontSize:'0.82rem' }}>{m.mobileNo || '—'}</td>
                        <td style={{ color:'var(--accent)' }}>{fmt(m.roomLeavingDate)}</td>
                        <td>
                          <span style={{ background: daysLeft<=3?'rgba(231,76,60,0.12)':'rgba(240,165,0,0.12)', color:daysLeft<=3?'var(--danger)':'var(--accent)', padding:'2px 10px', borderRadius:10, fontWeight:700, fontSize:'0.8rem' }}>
                            {daysLeft} day{daysLeft!==1?'s':''} left
                          </span>
                        </td>
                        <td>{m.rent ? fmtMoney(m.rent) : '—'}</td>
                        <td>
                          {m.mobileNo && (
                            <button
                              style={{ background:'#25d366', color:'white', border:'none', borderRadius:5, padding:'5px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:700 }}
                              onClick={() => wa.sendReminder(m.mobileNo, m.name, m.roomNumber, m.rent || 0, 'stay renewal')}
                            >📱 Remind</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PART PAYMENTS TAB ───────────────────────────────────────────── */}
      {tab === 'partpay' && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ padding:'10px 14px', background:'rgba(155,89,182,0.06)', borderRadius:6, fontSize:'0.83rem', color:'var(--text2)', flex:1 }}>
              💳 These rooms have made part payments. Outstanding balance = Total Bill − Amount Paid.
            </div>
            <div style={{ marginLeft:16, textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:'0.72rem', color:'var(--text3)' }}>Total Outstanding</div>
              <div style={{ fontFamily:'Rajdhani', fontSize:'1.4rem', fontWeight:700, color:'#9b59b6' }}>{fmtMoney(totalBalanceDue)}</div>
            </div>
          </div>
          {filterSearch(partPayments, 'memberName').length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><p>No outstanding part payments{search ? ' matching search' : ''}</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Bill No.</th><th>Date</th><th>Room</th><th>Member(s)</th><th>Total Bill</th><th>Paid</th><th>Balance Due</th><th>Mode</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filterSearch(partPayments, 'memberName').map(r => (
                    <tr key={r._id}>
                      <td style={{ fontFamily:'monospace', fontSize:'0.78rem', color:'var(--accent)' }}>{r.billNumber || '—'}</td>
                      <td style={{ fontSize:'0.8rem' }}>{fmt(r.receiptDate)}</td>
                      <td>{r.roomNumber ? <span className="badge badge-blue">R{r.roomNumber}</span> : '—'}</td>
                      <td style={{ fontSize:'0.82rem', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.memberName}>{r.memberName || '—'}</td>
                      <td style={{ fontWeight:600 }}>{fmtMoney(r.totalAmount)}</td>
                      <td style={{ color:'var(--success)', fontWeight:600 }}>{fmtMoney(r.amountPaid)}</td>
                      <td>
                        <span style={{ background:'rgba(155,89,182,0.12)', color:'#9b59b6', padding:'3px 10px', borderRadius:10, fontWeight:700, fontSize:'0.82rem' }}>
                          {fmtMoney(r.balanceDue)}
                        </span>
                      </td>
                      <td><span className={`badge ${r.modeOfPayment==='online'?'badge-blue':'badge-green'}`} style={{ fontSize:'0.68rem' }}>{r.modeOfPayment}</span></td>
                      <td>
                        {r.memberMobile && (
                          <button
                            style={{ background:'#25d366', color:'white', border:'none', borderRadius:5, padding:'5px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:700, whiteSpace:'nowrap' }}
                            onClick={() => wa.sendCustom(r.memberMobile,
                              `🏠 *PAYMENT REMINDER*\n\nDear ${r.memberName},\n\nYou have an outstanding balance on your hostel account:\n\n📋 Bill No: ${r.billNumber}\n💰 Total Bill: ₹${r.totalAmount}\n✅ Paid: ₹${r.amountPaid}\n❗ *Balance Due: ₹${r.balanceDue}*\n\nPlease clear this at the earliest.\n\nThank you 🙏`
                            )}
                          >📱 WhatsApp</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
