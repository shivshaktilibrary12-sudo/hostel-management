import React, { useEffect, useState, useRef, useCallback } from 'react';
import { membersAPI, receiptsAPI, roomsAPI, whatsapp } from '../utils/api';
import { useToast } from '../context/ToastContext';

function numberToWords(num) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (!num || num === 0) return 'Zero';
  let n = Math.floor(num), words = '';
  if (Math.floor(n/100000)>0){words+=numberToWords(Math.floor(n/100000))+' Lakh ';n%=100000;}
  if (Math.floor(n/1000)>0){words+=numberToWords(Math.floor(n/1000))+' Thousand ';n%=1000;}
  if (Math.floor(n/100)>0){words+=numberToWords(Math.floor(n/100))+' Hundred ';n%=100;}
  if (n>0){if(n<20)words+=ones[n];else words+=tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');}
  return words.trim();
}

const EMPTY_FORM = {
  receiptNumber:'', billNumber:'', billYear:'', billSerial:'',
  roomNumber:'', packageName:'rent', fromDate:'', toDate:'',
  totalAmount:'', amountPaid:'', balanceDue:'0',
  isPartPayment: false,
  modeOfPayment:'cash', notes:'',
  receiptDate: new Date().toISOString().split('T')[0],
};

const PKG = { rent:'Rent / किराया', advance:'Advance / एडवांस', electric:'Electric / बिजली', final:'Final / अंतिम', other:'Other / अन्य' };
const LIMIT = 30;

export default function Receipts() {
  const [receipts, setReceipts]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [pages, setPages]             = useState(1);
  const [page, setPage]               = useState(1);
  const [members, setMembers]         = useState([]);
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomConfig, setRoomConfig]   = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [showPrint, setShowPrint]     = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [roomF, setRoomF]             = useState('');
  const [typeF, setTypeF]             = useState('');
  const [modeF, setModeF]             = useState('');
  const printRef = useRef();
  const toast = useToast();

  const loadReceipts = useCallback((p = 1) => {
    setLoading(true);
    const params = { page: p, limit: LIMIT };
    if (search)  params.search  = search;
    if (roomF)   params.room    = roomF;
    if (typeF)   params.type    = typeF;
    if (modeF)   params.mode    = modeF;
    receiptsAPI.getAll(params)
      .then(r => {
        const d = r.data;
        setReceipts(d.data || d || []);
        setTotal(d.total || 0);
        setPages(d.pages || 1);
        setPage(p);
      })
      .finally(() => setLoading(false));
  }, [search, roomF, typeF, modeF]);

  useEffect(() => { loadReceipts(1); }, [loadReceipts]);
  useEffect(() => {
    membersAPI.getAll({ limit: 500 }).then(r => setMembers(r.data?.data || r.data || []));
  }, []);

  const uniqueRooms = [...new Set(members.filter(m => m.roomNumber && m.isActive !== false).map(m => m.roomNumber))].sort((a, b) => a - b);

  // ── When room changes: load members + room config + auto-fill from/to dates ──
  const handleRoomChange = async (roomNo) => {
    setForm(p => ({ ...p, roomNumber: roomNo, fromDate: '', toDate: '', totalAmount: '', amountPaid: '', balanceDue: '0' }));
    setRoomConfig(null);
    if (!roomNo) { setRoomMembers([]); return; }
    const rm = members.filter(m => String(m.roomNumber) === String(roomNo) && m.isActive !== false);
    setRoomMembers(rm);
    try {
      const r = await roomsAPI.getOne(roomNo);
      const rd = r.data;
      setRoomConfig(rd);
      // Auto-fill amount from room config
      const amt = rd?.rent ? String(rd.rent) : '';
      // Auto-fill fromDate from last receipt toDate for this room
      const roomReceipts = receipts
        .filter(r2 => String(r2.roomNumber) === String(roomNo))
        .sort((a, b) => new Date(b.toDate) - new Date(a.toDate));
      const fromDate = roomReceipts[0]?.toDate
        ? new Date(new Date(roomReceipts[0].toDate).getTime() + 86400000).toISOString().split('T')[0]
        : (rm[0]?.roomJoinDate ? rm[0].roomJoinDate.split('T')[0] : '');
      setForm(p => ({ ...p, roomNumber: roomNo, totalAmount: amt, amountPaid: amt, fromDate }));
    } catch(e) {}
  };

  // ── When package changes: auto-fill amount ───────────────────────────────────
  const handlePackageChange = (pkg) => {
    setForm(p => {
      let amount = p.totalAmount;
      if (roomConfig) {
        if (pkg === 'rent')    amount = String(roomConfig.rent    || 0);
        if (pkg === 'advance') amount = String(roomConfig.advance || 0);
      }
      return { ...p, packageName: pkg, totalAmount: amount, amountPaid: p.isPartPayment ? p.amountPaid : amount };
    });
  };

  // ── When toDate changes: auto-update member leaving dates for that room ───────
  const handleToDateChange = (toDate) => {
    setForm(p => ({ ...p, toDate }));
    // We'll update roomLeavingDate on save, not live
  };

  // ── Part payment toggle ───────────────────────────────────────────────────────
  const handlePartPayment = (checked) => {
    setForm(p => ({
      ...p,
      isPartPayment: checked,
      amountPaid: checked ? '' : p.totalAmount,
      balanceDue: checked ? (parseFloat(p.totalAmount) || 0).toString() : '0',
    }));
  };

  // ── Recalculate balance due when amountPaid changes ──────────────────────────
  const handleAmountPaidChange = (val) => {
    const paid  = parseFloat(val) || 0;
    const total = parseFloat(form.totalAmount) || 0;
    const bal   = Math.max(0, total - paid);
    setForm(p => ({ ...p, amountPaid: val, balanceDue: bal.toString() }));
  };

  // ── Save receipt ─────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.roomNumber || !form.totalAmount) { toast('Room and amount required', 'error'); return; }
    const amountPaid = form.isPartPayment ? (parseFloat(form.amountPaid) || 0) : (parseFloat(form.totalAmount) || 0);
    const balanceDue = Math.max(0, (parseFloat(form.totalAmount) || 0) - amountPaid);
    try {
      // Build member list — all members in the room
      const allRoomMembers = roomMembers.map(m => ({ name: m.name, memberId: m._id, memberUniqueId: m.memberId, mobileNo: m.mobileNo }));
      const primaryMember  = roomMembers[0];
      const payload = {
        ...form,
        memberName:    allRoomMembers.map(m => m.name).join(', '),
        memberMobile:  primaryMember?.mobileNo || '',
        memberId:      primaryMember?._id || '',
        members:       allRoomMembers,
        totalAmount:   parseFloat(form.totalAmount) || 0,
        amountPaid,
        balanceDue,
        isPartPayment: form.isPartPayment,
        amountInWords: numberToWords(amountPaid) + ' Rupees Only',
        paymentType:   form.packageName,
        receiptNumber: parseInt(form.receiptNumber) || 1,
        billSerial:    parseInt(form.billSerial) || 1,
      };
      const res = await receiptsAPI.create(payload);

      // Auto-update roomLeavingDate for all members in this room if toDate was set
      if (form.toDate && roomMembers.length > 0) {
        await Promise.all(roomMembers.map(m =>
          membersAPI.update(m._id, { roomLeavingDate: form.toDate }).catch(() => {})
        ));
      }

      toast(`Receipt created${form.isPartPayment ? ` · Balance due: ₹${balanceDue.toLocaleString('en-IN')}` : ''}`);
      setShowModal(false);
      loadReceipts(page);
      setShowPrint(res.data);
    } catch(e) { toast(e.response?.data?.message || 'Error creating receipt', 'error'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this receipt?')) return;
    try { await receiptsAPI.delete(id); toast('Deleted'); loadReceipts(page); }
    catch(e) { toast(e.response?.data?.message || 'Error', 'error'); }
  };

  const openModal = async () => {
    try {
      const nums = await receiptsAPI.getNextNumbers();
      setForm({ ...EMPTY_FORM, ...nums.data, receiptDate: new Date().toISOString().split('T')[0] });
    } catch { setForm({ ...EMPTY_FORM }); }
    setRoomMembers([]); setRoomConfig(null);
    setShowModal(true);
  };

  const doPrint = () => {
    const w = window.open('', '_blank');
    w.document.write('<html><head><title>Receipt</title>');
    w.document.write('<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">');
    w.document.write('<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Noto Sans",sans-serif;padding:20px;color:#111;}</style>');
    w.document.write('</head><body>');
    w.document.write(printRef.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Receipts</h2><p>{total} receipts · cumulative room billing</p></div>
        <button className="btn btn-primary" onClick={openModal}>+ New Receipt</button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ flex: 2, minWidth: 140, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', outline: 'none', fontSize: '0.88rem' }}
          placeholder="Search member / bill no..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', outline: 'none' }}
          value={roomF} onChange={e => setRoomF(e.target.value)}>
          <option value="">All Rooms</option>
          {Array.from({length:20},(_,i)=>i+1).map(n => <option key={n} value={n}>Room {n}</option>)}
        </select>
        <select style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', outline: 'none' }}
          value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="">All Types</option>
          {Object.entries(PKG).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', outline: 'none' }}
          value={modeF} onChange={e => setModeF(e.target.value)}>
          <option value="">All Modes</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
        </select>
      </div>

      <div className="card">
        {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Bill No.</th><th>Date</th><th>Room</th><th>Members</th>
                    <th>Type</th><th>Total</th><th>Paid</th><th>Balance</th><th>Mode</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length === 0 ? (
                    <tr><td colSpan={11}><div className="empty-state"><div className="empty-icon">🧾</div><p>No receipts yet</p></div></td></tr>
                  ) : receipts.map((r, i) => (
                    <tr key={r._id}>
                      <td style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>#{r.receiptNumber || i+1}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--accent)' }}>{r.billNumber || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-IN') : '—'}</td>
                      <td>{r.roomNumber ? <span className="badge badge-blue">R{r.roomNumber}</span> : '—'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.memberName || '—'}</td>
                      <td><span className="badge badge-yellow" style={{ fontSize: '0.68rem' }}>{r.packageName || '—'}</span></td>
                      <td style={{ color: 'var(--text)', fontWeight: 600 }}>₹{(r.totalAmount||0).toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>₹{(r.amountPaid||r.totalAmount||0).toLocaleString('en-IN')}</td>
                      <td style={{ color: (r.balanceDue||0) > 0 ? 'var(--danger)' : 'var(--text3)', fontWeight: (r.balanceDue||0) > 0 ? 700 : 400, fontSize: '0.82rem' }}>
                        {(r.balanceDue||0) > 0 ? `₹${r.balanceDue.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td><span className={`badge ${r.modeOfPayment==='online'?'badge-blue':'badge-green'}`} style={{ fontSize: '0.68rem' }}>{r.modeOfPayment||'cash'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-success btn-xs" onClick={() => setShowPrint(r)}>🖨</button>
                          {r.memberMobile && (
                            <button className="btn btn-xs" style={{ background: '#25d366', color: 'white', border: 'none' }}
                              onClick={() => whatsapp.sendReceipt(r.memberMobile, r)} title="WhatsApp">📱</button>
                          )}
                          <button className="btn btn-danger btn-xs" onClick={() => del(r._id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
                <button className="btn btn-secondary btn-xs" disabled={page === 1} onClick={() => loadReceipts(page-1)}>← Prev</button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Page {page} of {pages} · {total} receipts</span>
                <button className="btn btn-secondary btn-xs" disabled={page === pages} onClick={() => loadReceipts(page+1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── New Receipt Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h3>Generate Room Receipt</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                {/* Date + Receipt# + Bill# */}
                <div className="form-group"><label>Date</label>
                  <input type="date" value={form.receiptDate} onChange={e => setForm(p => ({...p, receiptDate: e.target.value}))} /></div>
                <div className="form-group"><label>Receipt #</label>
                  <input type="number" value={form.receiptNumber} onChange={e => setForm(p => ({...p, receiptNumber: e.target.value}))} /></div>
                <div className="form-group full"><label>Bill Number</label>
                  <input value={form.billNumber} onChange={e => setForm(p => ({...p, billNumber: e.target.value}))} placeholder="SB/26-27/001" /></div>

                {/* Room selector */}
                <div className="form-group full">
                  <label>Select Room</label>
                  <select value={form.roomNumber} onChange={e => handleRoomChange(e.target.value)}>
                    <option value="">— Select Room —</option>
                    {uniqueRooms.map(n => <option key={n} value={n}>Room {n}</option>)}
                  </select>
                  {roomConfig && (
                    <div style={{ marginTop: 6, padding: '7px 10px', background: 'rgba(240,165,0,0.07)', borderRadius: 5, fontSize: '0.78rem', color: 'var(--text2)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>🏷️ Fixed Rent: <strong style={{ color: 'var(--accent)' }}>₹{(roomConfig.rent||0).toLocaleString('en-IN')}</strong></span>
                      <span>💵 Fixed Advance: <strong style={{ color: 'var(--info)' }}>₹{(roomConfig.advance||0).toLocaleString('en-IN')}</strong></span>
                      <span>👥 Members: <strong>{roomConfig.memberCount||0}/{roomConfig.maxCapacity||6}</strong></span>
                    </div>
                  )}
                </div>

                {/* All members in room — display only */}
                {roomMembers.length > 0 && (
                  <div className="form-group full">
                    <label>Members in Room (all included in this receipt)</label>
                    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
                      {roomMembers.map((m, i) => (
                        <div key={m._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.85rem', borderBottom: i < roomMembers.length-1 ? '1px dashed var(--border)' : 'none' }}>
                          <span style={{ color: 'var(--text)', fontWeight: 500 }}>👤 {m.name}</span>
                          <span style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>📱 {m.mobileNo}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 4 }}>
                      This is a cumulative receipt for all {roomMembers.length} member{roomMembers.length > 1 ? 's' : ''} in Room {form.roomNumber}
                    </div>
                  </div>
                )}

                {/* Package + Mode */}
                <div className="form-group">
                  <label>Package</label>
                  <select value={form.packageName} onChange={e => handlePackageChange(e.target.value)}>
                    {Object.entries(PKG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Mode</label>
                  <select value={form.modeOfPayment} onChange={e => setForm(p => ({...p, modeOfPayment: e.target.value}))}>
                    <option value="cash">Cash / नगद</option>
                    <option value="online">Online / ऑनलाइन</option>
                  </select>
                </div>

                {/* From / To dates — toDate auto-updates member plan */}
                <div className="form-group">
                  <label>From Period</label>
                  <input type="date" value={form.fromDate} onChange={e => setForm(p => ({...p, fromDate: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>To Period <span style={{ fontSize: '0.68rem', color: 'var(--success)', textTransform: 'none', fontWeight: 400 }}>— auto-updates member due date</span></label>
                  <input type="date" value={form.toDate} onChange={e => handleToDateChange(e.target.value)} />
                </div>

                {/* Total Amount */}
                <div className="form-group">
                  <label>Total Bill Amount (₹)</label>
                  <input type="number" value={form.totalAmount}
                    onChange={e => {
                      setForm(p => ({
                        ...p,
                        totalAmount: e.target.value,
                        amountPaid: p.isPartPayment ? p.amountPaid : e.target.value,
                        balanceDue: p.isPartPayment ? String(Math.max(0, parseFloat(e.target.value)||0 - parseFloat(p.amountPaid)||0)) : '0',
                      }));
                    }}
                    placeholder="Auto-filled from room config" />
                </div>

                {/* Part Payment toggle */}
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <label>Part Payment?</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                    <input type="checkbox" checked={form.isPartPayment}
                      onChange={e => handlePartPayment(e.target.checked)}
                      id="partPayCheck" style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    <label htmlFor="partPayCheck" style={{ textTransform: 'none', color: 'var(--text)', fontSize: '0.88rem', cursor: 'pointer', fontWeight: 400 }}>
                      Member is paying part of the total
                    </label>
                  </div>
                </div>

                {/* Part payment fields — only shown when isPartPayment is true */}
                {form.isPartPayment && (
                  <>
                    <div className="form-group">
                      <label>Amount Paid Now (₹)</label>
                      <input type="number" value={form.amountPaid}
                        onChange={e => handleAmountPaidChange(e.target.value)}
                        placeholder="How much paid today" />
                    </div>
                    <div className="form-group">
                      <label>Balance Due (₹)</label>
                      <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid rgba(231,76,60,0.4)', borderRadius: 6, fontFamily: 'Rajdhani', fontSize: '1.2rem', fontWeight: 700, color: parseFloat(form.balanceDue) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ₹{(parseFloat(form.balanceDue)||0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </>
                )}

                {/* Amount in words */}
                <div className="form-group full">
                  <label>Amount in Words</label>
                  <input
                    value={form.isPartPayment
                      ? (form.amountPaid ? numberToWords(parseFloat(form.amountPaid)||0)+' Rupees Only (Part Payment)' : '')
                      : (form.totalAmount ? numberToWords(parseFloat(form.totalAmount)||0)+' Rupees Only' : '')}
                    readOnly style={{ background: 'var(--bg)', cursor: 'default', fontSize: '0.82rem' }} />
                </div>

                <div className="form-group full"><label>Notes</label>
                  <input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                    placeholder={form.isPartPayment ? `Part payment received. Balance: ₹${form.balanceDue}` : 'Optional notes'} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Generate Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print / WhatsApp Modal ──────────────────────────────────────────── */}
      {showPrint && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPrint(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Receipt — {showPrint.billNumber}</h3>
              <button className="close-btn" onClick={() => setShowPrint(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ background: 'white' }}>
              <div ref={printRef}><ReceiptPrint receipt={showPrint} /></div>
            </div>
            <div className="modal-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowPrint(null)}>Close</button>
              <button className="btn btn-primary" onClick={doPrint}>🖨 Print / PDF</button>
              {showPrint?.memberMobile && (
                <>
                  <button style={{ background: '#25d366', color: 'white', border: 'none', padding: '9px 16px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'Rajdhani' }}
                    onClick={() => whatsapp.sendReceipt(showPrint.memberMobile, showPrint)}>
                    📱 WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptPrint({ receipt }) {
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const paidAmt  = receipt.amountPaid || receipt.totalAmount || 0;
  const words    = receipt.amountInWords || (numberToWords(paidAmt) + ' Rupees Only');
  const isPartPay = receipt.isPartPayment && (receipt.balanceDue || 0) > 0;
  const PKGl = { rent:'Rent / किराया', advance:'Advance / एडवांस', electric:'Electric / बिजली', final:'Final / अंतिम', other:'Other / अन्य' };

  // Get all members list
  const membersList = receipt.members?.length > 0
    ? receipt.members.map(m => m.name).join(', ')
    : receipt.memberName || '—';

  return (
    <div style={{ fontFamily: '"Noto Sans",sans-serif', background: 'white', color: '#111', padding: '28px', fontSize: '13px' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: 1 }}>HOSTEL MANAGER</div>
        <div style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {isPartPay ? 'Part Payment Receipt / आंशिक भुगतान रसीद' : 'Payment Receipt / भुगतान रसीद'}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div><span style={{ color: '#555' }}>Date: </span><strong>{fmt(receipt.receiptDate)}</strong></div>
        <div><span style={{ color: '#555' }}>Receipt #</span><strong>{receipt.receiptNumber}</strong></div>
      </div>
      <div style={{ marginBottom: 12 }}><span style={{ color: '#555' }}>Bill No.: </span><strong style={{ fontSize: '1rem', color: '#c00' }}>{receipt.billNumber || '—'}</strong></div>
      {[
        ['Members / सदस्य',        membersList],
        ['Contact / संपर्क',        receipt.memberMobile],
        ['Room / कमरा',             receipt.roomNumber ? `Room ${receipt.roomNumber}` : '—'],
        ['Package / पैकेज',          PKGl[receipt.packageName] || receipt.packageName],
        ['From / दिनांक से',         fmt(receipt.fromDate)],
        ['To / दिनांक तक',           fmt(receipt.toDate)],
        ['Mode / भुगतान',            receipt.modeOfPayment === 'online' ? 'Online / ऑनलाइन' : 'Cash / नगद'],
      ].map(([l, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #ddd' }}>
          <span style={{ color: '#555' }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}

      {/* Part payment breakdown */}
      {isPartPay && (
        <div style={{ margin: '12px 0', padding: '10px', background: '#fff8e1', border: '1px solid #f39c12', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#555' }}>Total Bill Amount</span>
            <span style={{ fontWeight: 600 }}>₹{(receipt.totalAmount||0).toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#555' }}>Amount Paid Today</span>
            <span style={{ fontWeight: 700, color: '#27ae60' }}>₹{paidAmt.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f39c12', paddingTop: 6, marginTop: 4 }}>
            <span style={{ color: '#c00', fontWeight: 700 }}>Balance Due</span>
            <span style={{ fontWeight: 700, color: '#c00' }}>₹{(receipt.balanceDue||0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      <div style={{ margin: '14px 0', padding: '10px', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 4 }}>
        <div style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Sum of Rupees Paid</div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#222' }}>{words}</div>
      </div>
      <div style={{ textAlign: 'center', padding: '14px', background: '#111', color: 'white', borderRadius: 6, margin: '10px 0' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 3, opacity: 0.7 }}>AMOUNT PAID</div>
        <div style={{ fontSize: '2rem', fontWeight: 900 }}>₹{paidAmt.toLocaleString('en-IN')}</div>
        {isPartPay && <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 3 }}>Part Payment · Balance: ₹{(receipt.balanceDue||0).toLocaleString('en-IN')}</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
        <div style={{ width: 180, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: 6, fontSize: '12px', color: '#555' }}>हस्ताक्षर / Signature</div>
        </div>
      </div>
      {receipt.notes && <div style={{ marginTop: 10, fontSize: '11px', color: '#777' }}>Note: {receipt.notes}</div>}
    </div>
  );
}
