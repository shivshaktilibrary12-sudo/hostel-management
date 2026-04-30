import React, { useEffect, useState, useRef } from 'react';
import { membersAPI, receiptsAPI, salaryAPI, backupAPI } from '../utils/api';

export default function Reports() {
  const [members,   setMembers]   = useState([]);
  const [receipts,  setReceipts]  = useState([]);
  const [salary,    setSalary]    = useState([]);
  const [tab,       setTab]       = useState('overview');
  const [filters,   setFilters]   = useState({ room:'', mode:'', type:'', search:'', from:'', to:'' });
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting] = useState('');
  const [page,      setPage]      = useState(1);
  const LIMIT = 50;

  const overviewRef = useRef();
  const paymentsRef = useRef();
  const roomsRef    = useRef();
  const membersRef  = useRef();

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
  const totalIncome   = receipts.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const cashTotal     = receipts.filter(r => r.modeOfPayment === 'cash').reduce((s, r) => s + (r.totalAmount || 0), 0);
  const onlineTotal   = receipts.filter(r => r.modeOfPayment === 'online').reduce((s, r) => s + (r.totalAmount || 0), 0);
  const totalSalary   = salary.reduce((s, r) => s + (r.netSalary || 0), 0);
  const totalMaint    = salary.reduce((s, r) => s + (r.maintenanceCosts || []).reduce((a, c) => a + (c.amount || 0), 0), 0);
  const totalExpend   = totalSalary + totalMaint;
  const netBalance    = totalIncome - totalExpend;
  const maxRooms      = Math.max(...members.filter(m => m.roomNumber).map(m => m.roomNumber), 20);

  const filteredReceipts = receipts.filter(r =>
    (!filters.room   || String(r.roomNumber) === filters.room) &&
    (!filters.mode   || r.modeOfPayment === filters.mode) &&
    (!filters.type   || r.packageName === filters.type) &&
    (!filters.from   || new Date(r.receiptDate) >= new Date(filters.from)) &&
    (!filters.to     || new Date(r.receiptDate) <= new Date(filters.to)) &&
    (!filters.search ||
      (r.memberName || '').toLowerCase().includes(filters.search.toLowerCase()) ||
      String(r.roomNumber).includes(filters.search) ||
      (r.billNumber  || '').includes(filters.search) ||
      (r.memberMobile|| '').includes(filters.search))
  );

  const pagedReceipts = filteredReceipts.slice((page - 1) * LIMIT, page * LIMIT);
  const pages = Math.ceil(filteredReceipts.length / LIMIT);

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  const downloadBlob = (data, filename, type) => {
    const url = window.URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportCSV = async (collection) => {
    setExporting(collection);
    try {
      const res = await backupAPI.exportCSV(collection);
      downloadBlob(res.data, collection + '-' + new Date().toISOString().split('T')[0] + '.csv', 'text/csv');
    } catch(e) { alert('Export failed. Check server.'); }
    finally { setExporting(''); }
  };

  const exportJSON = async () => {
    setExporting('json');
    try {
      const res = await backupAPI.exportJSON();
      downloadBlob(res.data, 'hostel-backup-' + new Date().toISOString().split('T')[0] + '.json', 'application/json');
    } catch(e) { alert('Backup failed. Check server.'); }
    finally { setExporting(''); }
  };

  const exportFilteredCSV = () => {
    const headers = ['Date','Bill No','Room','Member','Mobile','Type','Mode','Rent','Advance','Electric','Other','Total'];
    const rows = filteredReceipts.map(r => [
      new Date(r.receiptDate).toLocaleDateString('en-IN'),
      r.billNumber || '',
      r.roomNumber,
      (r.memberName || '').replace(/,/g, ';'),
      r.memberMobile || '',
      r.packageName,
      r.modeOfPayment,
      r.rent || 0, r.advance || 0, r.electric || 0, r.other || 0, r.totalAmount || 0,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csv, 'receipts-filtered-' + new Date().toISOString().split('T')[0] + '.csv', 'text/csv');
  };

  const doPrint = (ref) => {
    const w = window.open('', '_blank');
    w.document.write('<html><head><title>Report</title>');
    w.document.write('<style>');
    w.document.write('body{font-family:Arial,sans-serif;padding:20px;color:#111;font-size:12px;}');
    w.document.write('table{width:100%;border-collapse:collapse;margin-bottom:16px;}');
    w.document.write('th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;}');
    w.document.write('th{background:#f5f5f5;font-weight:700;}');
    w.document.write('h2,h3{margin:12px 0 6px;}');
    w.document.write('@media print{@page{margin:10mm;}}');
    w.document.write('</style></head><body>');
    w.document.write('<p style="margin-bottom:12px;color:#555;">' + new Date().toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }) + '</p>');
    w.document.write(ref.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const selStyle = {
    background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6,
    padding:'7px 10px', color:'var(--text)', outline:'none', fontSize:'0.82rem',
  };

  const SCard = ({ label, value, color, sub }) => (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px 18px' }}>
      <div style={{ fontSize:'0.68rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:'Rajdhani', fontSize:'1.5rem', fontWeight:700, color: color || 'var(--accent)' }}>{value}</div>
      {sub && <div style={{ fontSize:'0.72rem', color:'var(--text3)', marginTop:2 }}>{sub}</div>}
    </div>
  );

  if (loading) return <div style={{ padding:40, color:'var(--text3)', textAlign:'center' }}>Loading reports...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Reports &amp; Export</h2>
          <p>Financial analytics and data export</p>
        </div>
        <button className="btn btn-secondary" onClick={exportJSON} disabled={!!exporting}>
          {exporting === 'json' ? 'Generating...' : 'Full Backup (JSON)'}
        </button>
      </div>

      <div className="tabs">
        {['overview','payments','rooms','members','export'].map(t => (
          <button key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => { setTab(t); setPage(1); }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="btn btn-secondary btn-xs" onClick={() => doPrint(overviewRef)}>Print Overview</button>
          </div>
          <div ref={overviewRef}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
              <SCard label="Total Income"      value={'Rs.' + fmt(totalIncome)}   color="var(--success)" />
              <SCard label="Total Expenditure" value={'Rs.' + fmt(totalExpend)}   color="var(--danger)"  />
              <SCard label="Net Balance"       value={'Rs.' + fmt(netBalance)}    color={netBalance >= 0 ? 'var(--success)' : 'var(--danger)'} />
              <SCard label="Active Members"    value={activeMembers.length}       color="var(--info)"    />
              <SCard label="Cash Received"     value={'Rs.' + fmt(cashTotal)}     sub={receipts.filter(r => r.modeOfPayment === 'cash').length + ' txn'} />
              <SCard label="Online Received"   value={'Rs.' + fmt(onlineTotal)}   color="var(--info)" sub={receipts.filter(r => r.modeOfPayment === 'online').length + ' txn'} />
              <SCard label="Salary Paid"       value={'Rs.' + fmt(totalSalary)}   color="var(--danger)" />
              <SCard label="Maintenance"       value={'Rs.' + fmt(totalMaint)}    color="var(--danger)" />
            </div>

            <div className="card">
              <h3 style={{ fontFamily:'Rajdhani', marginBottom:14, fontSize:'0.95rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Month-wise Revenue</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Month</th><th>Receipts</th><th>Rent</th><th>Electric</th><th>Advance</th><th>Other</th><th>Total</th></tr></thead>
                  <tbody>
                    {(() => {
                      const byMonth = {};
                      receipts.forEach(r => {
                        const d = new Date(r.receiptDate);
                        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0');
                        const label = d.toLocaleString('en-IN', { month:'short', year:'numeric' });
                        if (!byMonth[key]) byMonth[key] = { label, count:0, rent:0, electric:0, advance:0, other:0, total:0 };
                        byMonth[key].count++;
                        byMonth[key].rent     += r.rent     || 0;
                        byMonth[key].electric += r.electric || 0;
                        byMonth[key].advance  += r.advance  || 0;
                        byMonth[key].other    += r.other    || 0;
                        byMonth[key].total    += r.totalAmount || 0;
                      });
                      return Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([key, m]) => (
                        <tr key={key}>
                          <td style={{ fontWeight:600 }}>{m.label}</td>
                          <td>{m.count}</td>
                          <td>{m.rent     ? 'Rs.' + fmt(m.rent)     : '-'}</td>
                          <td>{m.electric ? 'Rs.' + fmt(m.electric) : '-'}</td>
                          <td>{m.advance  ? 'Rs.' + fmt(m.advance)  : '-'}</td>
                          <td>{m.other    ? 'Rs.' + fmt(m.other)    : '-'}</td>
                          <td style={{ color:'var(--accent)', fontWeight:700 }}>Rs.{fmt(m.total)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENTS ── */}
      {tab === 'payments' && (
        <div className="card">
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <input value={filters.search} onChange={e => { setFilters(p => ({...p, search:e.target.value})); setPage(1); }}
              placeholder="Search member / bill / mobile..." style={{ ...selStyle, minWidth:200, flex:1 }} />
            <select style={selStyle} value={filters.room} onChange={e => { setFilters(p => ({...p, room:e.target.value})); setPage(1); }}>
              <option value="">All Rooms</option>
              {Array.from({ length: maxRooms }, (_, i) => i + 1).map(n => <option key={n} value={n}>Room {n}</option>)}
            </select>
            <select style={selStyle} value={filters.mode} onChange={e => { setFilters(p => ({...p, mode:e.target.value})); setPage(1); }}>
              <option value="">All Modes</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
            <select style={selStyle} value={filters.type} onChange={e => { setFilters(p => ({...p, type:e.target.value})); setPage(1); }}>
              <option value="">All Types</option>
              <option value="rent">Rent</option>
              <option value="advance">Advance</option>
              <option value="electric">Electric</option>
              <option value="other">Other</option>
            </select>
            <input type="date" style={selStyle} value={filters.from} onChange={e => { setFilters(p => ({...p, from:e.target.value})); setPage(1); }} />
            <input type="date" style={selStyle} value={filters.to}   onChange={e => { setFilters(p => ({...p, to:e.target.value})); setPage(1); }} />
            <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ color:'var(--accent)', fontFamily:'Rajdhani', fontWeight:700 }}>
                Rs.{fmt(filteredReceipts.reduce((s, r) => s + (r.totalAmount || 0), 0))}
              </span>
              <button className="btn btn-secondary btn-xs" onClick={exportFilteredCSV}>Download CSV</button>
              <button className="btn btn-secondary btn-xs" onClick={() => doPrint(paymentsRef)}>Print</button>
            </div>
          </div>
          <div ref={paymentsRef}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Bill No</th><th>Room</th><th>Member</th><th>Type</th><th>Mode</th><th>Rent</th><th>Electric</th><th>Advance</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {pagedReceipts.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign:'center', padding:30, color:'var(--text3)' }}>No records found</td></tr>
                  ) : pagedReceipts.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontSize:'0.8rem' }}>{new Date(r.receiptDate).toLocaleDateString('en-IN')}</td>
                      <td style={{ fontFamily:'monospace', fontSize:'0.78rem', color:'var(--text3)' }}>{r.billNumber || '-'}</td>
                      <td><span className="badge badge-blue">R{r.roomNumber}</span></td>
                      <td style={{ fontWeight:500 }}>{r.memberName || '-'}</td>
                      <td><span className="badge badge-yellow">{r.packageName}</span></td>
                      <td><span className={'badge ' + (r.modeOfPayment === 'cash' ? 'badge-green' : 'badge-blue')}>{r.modeOfPayment}</span></td>
                      <td>{r.rent    ? 'Rs.' + fmt(r.rent)    : '-'}</td>
                      <td>{r.electric? 'Rs.' + fmt(r.electric): '-'}</td>
                      <td>{r.advance ? 'Rs.' + fmt(r.advance) : '-'}</td>
                      <td style={{ color:'var(--accent)', fontWeight:700 }}>Rs.{fmt(r.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:14, flexWrap:'wrap' }}>
                <button className="btn btn-secondary btn-xs" disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</button>
                <span style={{ color:'var(--text3)', fontSize:'0.82rem', alignSelf:'center' }}>Page {page} of {pages} ({filteredReceipts.length} records)</span>
                <button className="btn btn-secondary btn-xs" disabled={page===pages} onClick={() => setPage(p => p+1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ROOMS ── */}
      {tab === 'rooms' && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="btn btn-secondary btn-xs" onClick={() => doPrint(roomsRef)}>Print</button>
          </div>
          <div ref={roomsRef}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Room</th><th>Members</th><th>Rent/mo</th><th>Total Rent</th><th>Electric</th><th>Advance</th><th>Total Paid</th><th>Receipts</th></tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRooms }, (_, i) => i + 1).map(rn => {
                    const rr = receipts.filter(r => r.roomNumber === rn);
                    const rm = activeMembers.filter(m => m.roomNumber === rn);
                    if (rr.length === 0 && rm.length === 0) return null;
                    return (
                      <tr key={rn}>
                        <td><span className="badge badge-blue">Room {rn}</span></td>
                        <td style={{ fontSize:'0.8rem', color:'var(--text2)' }}>{rm.map(m => m.name).join(', ') || '-'}</td>
                        <td>{rm.length > 0 ? 'Rs.' + fmt(rm.reduce((s,m) => s+(m.rent||0), 0)) : '-'}</td>
                        <td>Rs.{fmt(rr.reduce((s,r) => s+(r.rent||0), 0))}</td>
                        <td>Rs.{fmt(rr.reduce((s,r) => s+(r.electric||0), 0))}</td>
                        <td>Rs.{fmt(rr.reduce((s,r) => s+(r.advance||0), 0))}</td>
                        <td style={{ color:'var(--accent)', fontWeight:700 }}>Rs.{fmt(rr.reduce((s,r) => s+(r.totalAmount||0), 0))}</td>
                        <td>{rr.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMBERS ── */}
      {tab === 'members' && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="btn btn-secondary btn-xs" onClick={() => doPrint(membersRef)}>Print</button>
          </div>
          <div ref={membersRef}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Mobile</th><th>Room</th><th>Join Date</th><th>Leaving</th><th>Rent</th><th>Police</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign:'center', padding:30, color:'var(--text3)' }}>No members</td></tr>
                  ) : members.map(m => (
                    <tr key={m._id}>
                      <td style={{ fontFamily:'monospace', fontSize:'0.76rem', color:'var(--accent)' }}>{m.memberId || '-'}</td>
                      <td style={{ fontWeight:500 }}>{m.name}</td>
                      <td style={{ fontSize:'0.82rem' }}>{m.mobileNo}</td>
                      <td>{m.roomNumber ? <span className="badge badge-blue">R{m.roomNumber}</span> : '-'}</td>
                      <td style={{ fontSize:'0.8rem' }}>{m.roomJoinDate ? new Date(m.roomJoinDate).toLocaleDateString('en-IN') : '-'}</td>
                      <td style={{ fontSize:'0.8rem', color: m.roomLeavingDate && new Date(m.roomLeavingDate) < new Date() ? 'var(--danger)' : 'inherit' }}>
                        {m.roomLeavingDate ? new Date(m.roomLeavingDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td>Rs.{fmt(m.rent)}</td>
                      <td><span className={'badge ' + (m.policeFormVerified ? 'badge-green' : 'badge-red')}>{m.policeFormVerified ? 'Done' : 'Pending'}</span></td>
                      <td><span className={'badge ' + (m.isActive !== false ? 'badge-green' : 'badge-red')}>{m.isActive !== false ? 'Active' : 'Archived'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT ── */}
      {tab === 'export' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
          {[
            { key:'members',  label:'Members',            icon:'Users',  desc:'All member records — names, rooms, contacts, aadhar, dates' },
            { key:'receipts', label:'Receipts',           icon:'Receipt',desc:'All payment receipts with amounts, dates, bill numbers' },
            { key:'electric', label:'Electric',           icon:'Bolt',   desc:'Room-wise electricity readings and bills' },
            { key:'salary',   label:'Salary and Expenses',icon:'Money',  desc:'Staff salaries and maintenance records' },
          ].map(c => (
            <div key={c.key} className="card" style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontWeight:700, color:'var(--text)', fontSize:'1rem', marginBottom:4 }}>{c.label}</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text3)', flex:1 }}>{c.desc}</div>
              <button className="btn btn-secondary" onClick={() => exportCSV(c.key)} disabled={!!exporting}>
                {exporting === c.key ? 'Exporting...' : 'Download CSV (Excel)'}
              </button>
            </div>
          ))}
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:14, border:'1px solid rgba(240,165,0,0.3)' }}>
            <div style={{ fontWeight:700, color:'var(--text)', fontSize:'1rem', marginBottom:4 }}>Full Database Backup</div>
            <div style={{ fontSize:'0.8rem', color:'var(--text3)', flex:1 }}>Complete JSON backup of all data. Use to restore or migrate to a new server.</div>
            <button className="btn btn-primary" onClick={exportJSON} disabled={!!exporting}>
              {exporting === 'json' ? 'Generating...' : 'Download Full Backup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
