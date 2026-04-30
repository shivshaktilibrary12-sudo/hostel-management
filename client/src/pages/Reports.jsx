import React, { useEffect, useState } from 'react';
import { membersAPI, receiptsAPI, electricAPI, salaryAPI, backupAPI } from '../utils/api';

export default function Reports() {
  const [members, setMembers] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [salary, setSalary] = useState([]);
  const [tab, setTab] = useState('overview');
  const [filters, setFilters] = useState({ room: '', mode: '', type: '', search: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      membersAPI.getAll({ limit: 1000 }),
      receiptsAPI.getAll({ limit: 1000 }),
      salaryAPI.getAll(),
    ]).then(([m, r, s]) => {
      setMembers(m.data?.data || m.data || []);
      setReceipts(r.data?.data || r.data || []);
      setSalary(s.data?.data || s.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const activeMembers = members.filter(m => m.isActive !== false && m.roomNumber);

  const totalIncome = receipts.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const cashTotal = receipts.filter(r => r.modeOfPayment === 'cash').reduce((s, r) => s + (r.totalAmount || 0), 0);
  const onlineTotal = receipts.filter(r => r.modeOfPayment === 'online').reduce((s, r) => s + (r.totalAmount || 0), 0);
  const totalSalaryPaid = salary.reduce((s, r) => s + (r.netSalary || 0), 0);
  const totalMaintenance = salary.reduce((s, r) => s + (r.maintenanceCosts || []).reduce((a, c) => a + (c.amount || 0), 0), 0);
  const totalExpenditure = totalSalaryPaid + totalMaintenance;
  const netBalance = totalIncome - totalExpenditure;

  const filteredReceipts = receipts.filter(r =>
    (!filters.room || String(r.roomNumber) === filters.room) &&
    (!filters.mode || r.modeOfPayment === filters.mode) &&
    (!filters.type || r.packageName === filters.type) &&
    (!filters.search || (r.memberName || '').toLowerCase().includes(filters.search.toLowerCase()) || String(r.roomNumber).includes(filters.search) || (r.billNumber || '').includes(filters.search)) &&
    (!filters.from || new Date(r.receiptDate) >= new Date(filters.from)) &&
    (!filters.to || new Date(r.receiptDate) <= new Date(filters.to))
  );

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  const downloadBlob = (data, filename, type) => {
    const url = window.URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportCSV = async (collection) => {
    setExporting(collection);
    try {
      const res = await backupAPI.exportCSV(collection);
      downloadBlob(res.data, `${collection}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    } catch(e) { alert('Export failed'); }
    finally { setExporting(''); }
  };

  const exportJSON = async () => {
    setExporting('json');
    try {
      const res = await backupAPI.exportJSON();
      downloadBlob(res.data, `hostel-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    } catch(e) { alert('Backup failed'); }
    finally { setExporting(''); }
  };

  // Inline CSV for filtered receipts
  const exportFilteredCSV = () => {
    const headers = ['Date','Bill No','Room','Member','Type','Mode','Rent','Advance','Electric','Other','Total'];
    const rows = filteredReceipts.map(r => [
      new Date(r.receiptDate).toLocaleDateString('en-IN'), r.billNumber || '', r.roomNumber,
      (r.memberName || '').replace(/,/g, ';'), r.packageName, r.modeOfPayment,
      r.rent || 0, r.advance || 0, r.electric || 0, r.other || 0, r.totalAmount || 0,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csv, `receipts-filtered-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const selStyle = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', outline: 'none', fontSize: '0.82rem' };
  const StatCard = ({ label, value, color = 'var(--accent)', sub }) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 18px' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'Rajdhani', fontSize: '1.55rem', fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  if (loading) return <div style={{ padding: 40, color: 'var(--text3)', textAlign: 'center' }}>⏳ Loading reports...</div>;

  const maxRooms = Math.max(...members.filter(m => m.roomNumber).map(m => m.roomNumber), 20);


  const printReport = (title, tableContent) => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${title}</title>`);
    w.document.write('<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">');
    w.document.write('<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Noto Sans",sans-serif;padding:24px;color:#111;font-size:12px;}h1{font-size:1.3rem;margin-bottom:4px;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#1e2535;color:#f0a500;padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;}td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0;}.card{background:#f8f8f8;padding:12px;border-radius:6px;border:1px solid #ddd;}.card-label{font-size:10px;color:#666;text-transform:uppercase;}.card-value{font-size:1.2rem;font-weight:700;margin-top:3px;color:#111;}@media print{@page{margin:8mm;size:A4;}}</style>`);
    w.document.write('</head><body>');
    w.document.write('<h1>' + title + '</h1>');
    w.document.write('<div style="font-size:11px;color:#666;margin-bottom:8px;">Generated: ' + new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'}) + ' · Hostel Manager</div>');
    w.document.write(tableContent);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  const printOverview = () => {
    const html = \`
      <div class="summary">
        <div class="card"><div class="card-label">Total Income</div><div class="card-value">₹\${fmt(totalIncome)}</div></div>
        <div class="card"><div class="card-label">Cash</div><div class="card-value">₹\${fmt(cashTotal)}</div></div>
        <div class="card"><div class="card-label">Online</div><div class="card-value">₹\${fmt(onlineTotal)}</div></div>
        <div class="card"><div class="card-label">Net Balance</div><div class="card-value">₹\${fmt(netBalance)}</div></div>
      </div>
      <table>
        <thead><tr><th>Room</th><th>Members</th><th>Total Paid</th></tr></thead>
        <tbody>\${[...new Set(members.filter(m=>m.roomNumber).map(m=>m.roomNumber))].sort((a,b)=>a-b).map(rn => {
          const rMem = members.filter(m => m.roomNumber === rn);
          const rRec = receipts.filter(r => r.roomNumber === rn);
          const total = rRec.reduce((s,r) => s+(r.totalAmount||0), 0);
          return \`<tr><td>Room \${rn}</td><td>\${rMem.map(m=>m.name).join(', ')}</td><td>₹\${total.toLocaleString('en-IN')}</td></tr>\`;
        }).join('')}</tbody>
      </table>
    \`;
    printReport('Room Overview Report', html);
  };

  const printPayments = () => {
    const html = \`
      <table>
        <thead><tr><th>Date</th><th>Bill No</th><th>Room</th><th>Member</th><th>Type</th><th>Mode</th><th>Amount</th></tr></thead>
        <tbody>\${filteredReceipts.map(r => \`<tr>
          <td>\${new Date(r.receiptDate).toLocaleDateString('en-IN')}</td>
          <td>\${r.billNumber||''}</td>
          <td>Room \${r.roomNumber||''}</td>
          <td>\${r.memberName||''}</td>
          <td>\${r.packageName||''}</td>
          <td>\${r.modeOfPayment||''}</td>
          <td>₹\${(r.totalAmount||0).toLocaleString('en-IN')}</td>
        </tr>\`).join('')}</tbody>
      </table>
    \`;
    printReport('Payment Report', html);
  };

  const printMembers = () => {
    const html = \`
      <table>
        <thead><tr><th>Member ID</th><th>Name</th><th>Mobile</th><th>Room</th><th>Join Date</th><th>Leaving Date</th><th>Police Form</th></tr></thead>
        <tbody>\${activeMembers.map(m => \`<tr>
          <td>\${m.memberId||'—'}</td>
          <td>\${m.name}</td>
          <td>\${m.mobileNo}</td>
          <td>Room \${m.roomNumber||'—'}</td>
          <td>\${m.roomJoinDate ? new Date(m.roomJoinDate).toLocaleDateString('en-IN') : '—'}</td>
          <td>\${m.roomLeavingDate ? new Date(m.roomLeavingDate).toLocaleDateString('en-IN') : '—'}</td>
          <td>\${m.policeFormVerified ? 'Verified' : 'Pending'}</td>
        </tr>\`).join('')}</tbody>
      </table>
    \`;
    printReport('All Members Report', html);
  };

  const printExpenses = () => {
    const html = \`
      <table>
        <thead><tr><th>Employee</th><th>Role</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net</th><th>Month</th></tr></thead>
        <tbody>\${salary.map(s => \`<tr>
          <td>\${s.employeeName||''}</td><td>\${s.role||''}</td>
          <td>₹\${(s.basicSalary||0).toLocaleString('en-IN')}</td>
          <td>₹\${(s.allowances||0).toLocaleString('en-IN')}</td>
          <td>₹\${(s.deductions||0).toLocaleString('en-IN')}</td>
          <td>₹\${(s.netSalary||0).toLocaleString('en-IN')}</td>
          <td>\${s.month||''}</td>
        </tr>\`).join('')}</tbody>
      </table>
    \`;
    printReport('Salary & Expenses Report', html);
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Reports & Export</h2><p>Financial analytics and data export</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={exportJSON} disabled={!!exporting}>
            {exporting === 'json' ? '⏳' : '💾'} Full Backup (JSON)
          </button>
        </div>
      </div>

      <div className="tabs" style={{marginBottom:0}}>
        {['overview', 'payments', 'rooms', 'members', 'export'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button className="btn btn-secondary btn-sm" onClick={printOverview}>🖨 Print Overview</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatCard label="Total Income" value={`₹${fmt(totalIncome)}`} color="var(--success)" />
            <StatCard label="Total Expenditure" value={`₹${fmt(totalExpenditure)}`} color="var(--danger)" />
            <StatCard label="Net Balance" value={`₹${fmt(netBalance)}`} color={netBalance >= 0 ? 'var(--success)' : 'var(--danger)'} />
            <StatCard label="Active Members" value={activeMembers.length} color="var(--info)" />
            <StatCard label="Cash Received" value={`₹${fmt(cashTotal)}`} sub={`${receipts.filter(r => r.modeOfPayment === 'cash').length} txn`} />
            <StatCard label="Online Received" value={`₹${fmt(onlineTotal)}`} color="var(--info)" sub={`${receipts.filter(r => r.modeOfPayment === 'online').length} txn`} />
            <StatCard label="Salary Paid" value={`₹${fmt(totalSalaryPaid)}`} color="var(--danger)" />
            <StatCard label="Maintenance" value={`₹${fmt(totalMaintenance)}`} color="var(--danger)" />
          </div>

          {/* Month-wise breakdown */}
          <div className="card">
            <h3 style={{ fontFamily: 'Rajdhani', marginBottom: 14, fontSize: '0.95rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Month-wise Revenue</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Month</th><th>Receipts</th><th>Rent</th><th>Electric</th><th>Advance</th><th>Other</th><th>Total</th></tr></thead>
                <tbody>
                  {(() => {
                    const byMonth = {};
                    receipts.forEach(r => {
                      const d = new Date(r.receiptDate);
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
                      if (!byMonth[key]) byMonth[key] = { label, count: 0, rent: 0, electric: 0, advance: 0, other: 0, total: 0 };
                      byMonth[key].count++;
                      byMonth[key].rent += r.rent || 0;
                      byMonth[key].electric += r.electric || 0;
                      byMonth[key].advance += r.advance || 0;
                      byMonth[key].other += r.other || 0;
                      byMonth[key].total += r.totalAmount || 0;
                    });
                    return Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([key, m]) => (
                      <tr key={key}>
                        <td style={{ fontWeight: 600 }}>{m.label}</td>
                        <td>{m.count}</td>
                        <td>{m.rent ? `₹${fmt(m.rent)}` : '—'}</td>
                        <td>{m.electric ? `₹${fmt(m.electric)}` : '—'}</td>
                        <td>{m.advance ? `₹${fmt(m.advance)}` : '—'}</td>
                        <td>{m.other ? `₹${fmt(m.other)}` : '—'}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{fmt(m.total)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button className="btn btn-secondary btn-sm" onClick={printPayments}>🖨 Print Report</button></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} placeholder="Search member / bill..." style={selStyle} />
            <select style={selStyle} value={filters.room} onChange={e => setFilters(p => ({ ...p, room: e.target.value }))}>
              <option value="">All Rooms</option>
              {Array.from({ length: maxRooms }, (_, i) => i + 1).map(n => <option key={n} value={n}>Room {n}</option>)}
            </select>
            <select style={selStyle} value={filters.mode} onChange={e => setFilters(p => ({ ...p, mode: e.target.value }))}>
              <option value="">All Modes</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
            <select style={selStyle} value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}>
              <option value="">All Types</option>
              <option value="rent">Rent</option>
              <option value="advance">Advance</option>
              <option value="electric">Electric</option>
              <option value="other">Other</option>
            </select>
            <input type="date" style={selStyle} value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} title="From date" />
            <input type="date" style={selStyle} value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} title="To date" />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--accent)', fontFamily: 'Rajdhani', fontWeight: 700 }}>₹{fmt(filteredReceipts.reduce((s, r) => s + (r.totalAmount || 0), 0))}</span>
              <button className="btn btn-secondary btn-xs" onClick={exportFilteredCSV}>📥 CSV</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Bill No</th><th>Room</th><th>Member</th><th>Type</th><th>Mode</th><th>Rent</th><th>Electric</th><th>Advance</th><th>Total</th></tr></thead>
              <tbody>
                {filteredReceipts.length === 0 ? (
                  <tr><td colSpan={10}><div className="empty-state"><div className="empty-icon">📊</div><p>No records found</p></div></td></tr>
                ) : filteredReceipts.map(r => (
                  <tr key={r._id}>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(r.receiptDate).toLocaleDateString('en-IN')}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text3)' }}>{r.billNumber || '—'}</td>
                    <td><span className="badge badge-blue">R{r.roomNumber}</span></td>
                    <td style={{ fontWeight: 500 }}>{r.memberName || '—'}</td>
                    <td><span className="badge badge-yellow">{r.packageName}</span></td>
                    <td><span className={`badge ${r.modeOfPayment === 'cash' ? 'badge-green' : 'badge-blue'}`}>{r.modeOfPayment}</span></td>
                    <td>{r.rent ? `₹${fmt(r.rent)}` : '—'}</td>
                    <td>{r.electric ? `₹${fmt(r.electric)}` : '—'}</td>
                    <td>{r.advance ? `₹${fmt(r.advance)}` : '—'}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{fmt(r.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rooms' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button className="btn btn-secondary btn-sm" onClick={() => printReport('Room Details Report', document.querySelector('[data-room-table]')?.outerHTML || '<p>No data</p>')}>🖨 Print Report</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Room</th><th>Members</th><th>Rent/mo</th><th>Total Rent</th><th>Electric</th><th>Advance</th><th>Total Paid</th><th>Receipts</th></tr></thead>
              <tbody>
                {Array.from({ length: maxRooms }, (_, i) => i + 1).map(rn => {
                  const rr = receipts.filter(r => r.roomNumber === rn);
                  const rm = activeMembers.filter(m => m.roomNumber === rn);
                  if (rr.length === 0 && rm.length === 0) return null;
                  return (
                    <tr key={rn}>
                      <td><span className="badge badge-blue">Room {rn}</span></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{rm.map(m => m.name).join(', ') || '—'}</td>
                      <td>{rm.length > 0 ? `₹${fmt(rm.reduce((s, m) => s + (m.rent || 0), 0))}` : '—'}</td>
                      <td>₹{fmt(rr.reduce((s, r) => s + (r.rent || 0), 0))}</td>
                      <td>₹{fmt(rr.reduce((s, r) => s + (r.electric || 0), 0))}</td>
                      <td>₹{fmt(rr.reduce((s, r) => s + (r.advance || 0), 0))}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{fmt(rr.reduce((s, r) => s + (r.totalAmount || 0), 0))}</td>
                      <td>{rr.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button className="btn btn-secondary btn-sm" onClick={printMembers}>🖨 Print Members</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>Room</th><th>Join</th><th>Leaving</th><th>Rent</th><th>Police</th><th>Status</th></tr></thead>
              <tbody>
                {members.length === 0 ? (
                  <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">👥</div><p>No members</p></div></td></tr>
                ) : members.map(m => (
                  <tr key={m._id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: 'var(--accent)' }}>{m.memberId || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td style={{ fontSize: '0.82rem' }}>{m.mobileNo}</td>
                    <td>{m.roomNumber ? <span className="badge badge-blue">R{m.roomNumber}</span> : '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{m.roomJoinDate ? new Date(m.roomJoinDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: m.roomLeavingDate && new Date(m.roomLeavingDate) < new Date() ? 'var(--danger)' : 'inherit' }}>
                      {m.roomLeavingDate ? new Date(m.roomLeavingDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>₹{fmt(m.rent)}</td>
                    <td><span className={`badge ${m.policeFormVerified ? 'badge-green' : 'badge-red'}`}>{m.policeFormVerified ? 'Done' : 'Pending'}</span></td>
                    <td><span className={`badge ${m.isActive !== false ? 'badge-green' : 'badge-red'}`}>{m.isActive !== false ? 'Active' : 'Archived'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'export' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {[
            { key: 'members', label: 'Members', icon: '👥', desc: 'All member records — names, rooms, contacts, aadhar, dates' },
            { key: 'receipts', label: 'Receipts', icon: '🧾', desc: 'All payment receipts with amounts, dates, modes' },
            { key: 'electric', label: 'Electric', icon: '⚡', desc: 'Room-wise electricity readings and bills' },
            { key: 'salary', label: 'Salary & Expenses', icon: '💰', desc: 'Staff salaries and maintenance records' },
          ].map(c => (
            <div key={c.key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '2rem' }}>{c.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1rem', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{c.desc}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => exportCSV(c.key)} disabled={!!exporting} style={{ marginTop: 'auto' }}>
                {exporting === c.key ? '⏳ Exporting...' : '📥 Download CSV (Excel)'}
              </button>
            </div>
          ))}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid rgba(240,165,0,0.3)' }}>
            <div style={{ fontSize: '2rem' }}>💾</div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1rem', marginBottom: 4 }}>Full Database Backup</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Complete JSON backup of all data. Use to restore data or migrate to new server.</div>
            </div>
            <button className="btn btn-primary" onClick={exportJSON} disabled={!!exporting} style={{ marginTop: 'auto' }}>
              {exporting === 'json' ? '⏳ Generating...' : '💾 Download Full Backup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
