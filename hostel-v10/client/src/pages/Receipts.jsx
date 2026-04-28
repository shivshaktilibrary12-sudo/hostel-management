import React, { useEffect, useState, useRef, useCallback } from 'react';
import { membersAPI, receiptsAPI, whatsapp } from '../utils/api';
import { useToast } from '../context/ToastContext';

function numberToWords(num) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (num === 0) return 'Zero';
  let words = '';
  if (Math.floor(num/100000)>0){words+=numberToWords(Math.floor(num/100000))+' Lakh ';num%=100000;}
  if (Math.floor(num/1000)>0){words+=numberToWords(Math.floor(num/1000))+' Thousand ';num%=1000;}
  if (Math.floor(num/100)>0){words+=numberToWords(Math.floor(num/100))+' Hundred ';num%=100;}
  if (num>0){if(num<20)words+=ones[num];else words+=tens[Math.floor(num/10)]+(num%10?' '+ones[num%10]:'');}
  return words.trim();
}

const EMPTY_FORM = {
  receiptNumber:'', billNumber:'', billYear:'', billSerial:'',
  roomNumber:'', memberName:'', memberMobile:'', memberId:'',
  packageName:'rent', fromDate:'', toDate:'',
  totalAmount:'', modeOfPayment:'cash', notes:'',
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
  const [showModal, setShowModal]     = useState(false);
  const [showPrint, setShowPrint]     = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [loading, setLoading]         = useState(false);
  // Filters
  const [search, setSearch]   = useState('');
  const [roomF, setRoomF]     = useState('');
  const [typeF, setTypeF]     = useState('');
  const [modeF, setModeF]     = useState('');
  const [fromF, setFromF]     = useState('');
  const [toF, setToF]         = useState('');

  const printRef = useRef();
  const toast = useToast();

  const loadReceipts = useCallback((p = 1) => {
    setLoading(true);
    receiptsAPI.getAll({ page: p, limit: LIMIT, search, room: roomF||undefined, type: typeF||undefined, mode: modeF||undefined, from: fromF||undefined, to: toF||undefined })
      .then(r => {
        const d = r.data;
        setReceipts(d?.data || d || []);
        setTotal(d?.total || 0);
        setPages(d?.pages || 1);
      })
      .finally(() => setLoading(false));
  }, [search, roomF, typeF, modeF, fromF, toF]);

  useEffect(() => { loadReceipts(page); }, [page]);
  useEffect(() => { setPage(1); loadReceipts(1); }, [search, roomF, typeF, modeF, fromF, toF]);

  useEffect(() => {
    membersAPI.getAll({ limit: 500 }).then(r => setMembers(r.data?.data || r.data || []));
  }, []);

  const openModal = async () => {
    try {
      const res = await receiptsAPI.getNextNumbers();
      setForm({ ...EMPTY_FORM, receiptNumber: res.data.receiptNumber, billNumber: res.data.billNumber, billYear: res.data.billYear, billSerial: res.data.billSerial, receiptDate: new Date().toISOString().split('T')[0] });
    } catch { setForm({ ...EMPTY_FORM }); }
    setRoomMembers([]);
    setShowModal(true);
  };

  const handleRoomChange = (roomNo) => {
    setForm(p => ({ ...p, roomNumber: roomNo, memberName: '', memberMobile: '', memberId: '', fromDate: '' }));
    if (!roomNo) { setRoomMembers([]); return; }
    setRoomMembers(members.filter(m => String(m.roomNumber) === String(roomNo) && m.isActive !== false));
  };

  const handleMemberSelect = (name) => {
    const m = roomMembers.find(x => x.name === name);
    if (!m) { setForm(p => ({ ...p, memberName: name, memberMobile: '', memberId: '', fromDate: '' })); return; }
    let fromDate = m.admissionDate ? m.admissionDate.split('T')[0] : '';
    const prevReceipts = receipts.filter(r => String(r.roomNumber) === String(m.roomNumber)).sort((a, b) => new Date(b.toDate) - new Date(a.toDate));
    if (prevReceipts.length > 0 && prevReceipts[0].toDate) fromDate = new Date(prevReceipts[0].toDate).toISOString().split('T')[0];
    setForm(p => ({ ...p, memberName: name, memberMobile: m.mobileNo, memberId: m._id, fromDate }));
  };

  const save = async () => {
    if (!form.roomNumber || !form.memberName || !form.totalAmount) { toast('Room, member and amount required', 'error'); return; }
    try {
      const payload = {
        ...form,
        totalAmount: parseFloat(form.totalAmount) || 0,
        amountInWords: numberToWords(parseFloat(form.totalAmount) || 0) + ' Rupees Only',
        paymentType: form.packageName,
        receiptNumber: parseInt(form.receiptNumber) || 1,
        billSerial: parseInt(form.billSerial) || 1,
        members: roomMembers.map(m => ({ name: m.name, memberId: m._id, memberUniqueId: m.memberId })),
      };
      const res = await receiptsAPI.create(payload);
      toast('Receipt created');
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

  const selStyle = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', outline: 'none', fontSize: '0.82rem' };
  const uniqueRooms = [...new Set(members.filter(m => m.roomNumber).map(m => m.roomNumber))].sort((a, b) => a - b);

  return (
    <div>
      <div className="page-header">
        <div><h2>Receipts</h2><p>{total} receipts</p></div>
        <button className="btn btn-primary" onClick={openModal}>+ New Receipt</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Name / bill no / mobile / room…" style={{ ...selStyle, flex: 1, minWidth: 180 }} />
        <select style={selStyle} value={roomF} onChange={e => setRoomF(e.target.value)}>
          <option value="">All Rooms</option>
          {uniqueRooms.map(n => <option key={n} value={n}>Room {n}</option>)}
        </select>
        <select style={selStyle} value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="">All Types</option>
          {Object.entries(PKG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select style={selStyle} value={modeF} onChange={e => setModeF(e.target.value)}>
          <option value="">All Modes</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
        </select>
        <input type="date" style={selStyle} value={fromF} onChange={e => setFromF(e.target.value)} title="From" />
        <input type="date" style={selStyle} value={toF} onChange={e => setToF(e.target.value)} title="To" />
        {(search||roomF||typeF||modeF||fromF||toF) && (
          <button className="btn btn-secondary btn-xs" onClick={() => { setSearch(''); setRoomF(''); setTypeF(''); setModeF(''); setFromF(''); setToF(''); }}>✕ Clear</button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>⏳ Loading...</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Bill No.</th><th>Date</th><th>Room</th><th>Member</th><th>Type</th><th>Amount</th><th>Mode</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {receipts.length === 0 ? (
                    <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">🧾</div><p>No receipts found</p></div></td></tr>
                  ) : receipts.map((r, i) => (
                    <tr key={r._id}>
                      <td style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>#{r.receiptNumber || i + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--accent)' }}>{r.billNumber || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-IN') : '—'}</td>
                      <td>{r.roomNumber ? <span className="badge badge-blue">R{r.roomNumber}</span> : '—'}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.memberName || '—'}</td>
                      <td><span className="badge badge-yellow">{PKG[r.packageName] || r.packageName}</span></td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{r.totalAmount}</td>
                      <td><span className={`badge ${r.modeOfPayment === 'online' ? 'badge-blue' : 'badge-green'}`}>{r.modeOfPayment}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
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

            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
                <button className="btn btn-secondary btn-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Page {page} of {pages} · {total} receipts</span>
                <button className="btn btn-secondary btn-xs" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Receipt Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header"><h3>Generate Receipt</h3><button className="close-btn" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Date</label><input type="date" value={form.receiptDate} onChange={e => setForm(p => ({...p, receiptDate: e.target.value}))} /></div>
                <div className="form-group"><label>Receipt #</label><input type="number" value={form.receiptNumber} onChange={e => setForm(p => ({...p, receiptNumber: e.target.value}))} /></div>
                <div className="form-group"><label>Bill Number</label><input value={form.billNumber} onChange={e => setForm(p => ({...p, billNumber: e.target.value}))} placeholder="SB/26-27/001" /></div>
                <div className="form-group">
                  <label>Select Room</label>
                  <select value={form.roomNumber} onChange={e => handleRoomChange(e.target.value)}>
                    <option value="">— Select Room —</option>
                    {uniqueRooms.map(n => <option key={n} value={n}>Room {n}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Member Name</label>
                  <select value={form.memberName} onChange={e => handleMemberSelect(e.target.value)} disabled={!form.roomNumber}>
                    <option value="">— Select Member —</option>
                    {roomMembers.map(m => <option key={m._id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Contact Number</label><input value={form.memberMobile} readOnly style={{ background: 'var(--bg)', cursor: 'default' }} placeholder="Auto-filled" /></div>
                <div className="form-group">
                  <label>Package</label>
                  <select value={form.packageName} onChange={e => setForm(p => ({...p, packageName: e.target.value}))}>
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
                <div className="form-group"><label>From Period</label><input type="date" value={form.fromDate} onChange={e => setForm(p => ({...p, fromDate: e.target.value}))} /></div>
                <div className="form-group"><label>To Period</label><input type="date" value={form.toDate} onChange={e => setForm(p => ({...p, toDate: e.target.value}))} /></div>
                <div className="form-group"><label>Amount (₹) *</label><input type="number" value={form.totalAmount} onChange={e => setForm(p => ({...p, totalAmount: e.target.value}))} placeholder="0" /></div>
                <div className="form-group"><label>Amount in Words</label><input value={form.totalAmount ? numberToWords(parseFloat(form.totalAmount)||0)+' Rupees Only' : ''} readOnly style={{ background: 'var(--bg)', cursor: 'default', fontSize: '0.8rem' }} /></div>
                <div className="form-group full"><label>Notes</label><input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Optional notes" /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Generate Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Print / WhatsApp / PDF Modal */}
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
                    📱 WhatsApp (Text)
                  </button>
                  <button style={{ background: '#128C7E', color: 'white', border: 'none', padding: '9px 16px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'Rajdhani' }}
                    onClick={() => { doPrint(); setTimeout(() => whatsapp.sendReceipt(showPrint.memberMobile, showPrint), 2000); }}
                    title="Print PDF first, then send on WhatsApp">
                    📄📱 PDF + WhatsApp
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
  const words = receipt.amountInWords || (numberToWords(receipt.totalAmount || 0) + ' Rupees Only');
  const PKG = { rent:'Rent / किराया', advance:'Advance / एडवांस', electric:'Electric / बिजली', final:'Final / अंतिम', other:'Other / अन्य' };
  return (
    <div style={{ fontFamily: '"Noto Sans",sans-serif', background: 'white', color: '#111', padding: '28px', fontSize: '13px' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: 1 }}>HOSTEL MANAGER</div>
        <div style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Payment Receipt / भुगतान रसीद</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div><span style={{ color: '#555' }}>Date / दिनांक: </span><strong>{fmt(receipt.receiptDate)}</strong></div>
        <div><span style={{ color: '#555' }}>Receipt No.: </span><strong>#{receipt.receiptNumber}</strong></div>
      </div>
      <div style={{ marginBottom: 14 }}><span style={{ color: '#555' }}>Bill No.: </span><strong style={{ fontSize: '1rem', color: '#c00' }}>{receipt.billNumber || '—'}</strong></div>
      {[
        ['Name / नाम', receipt.memberName],
        ['Contact / संपर्क', receipt.memberMobile],
        ['Room / कमरा', receipt.roomNumber ? `Room ${receipt.roomNumber}` : '—'],
        ['Package / पैकेज', PKG[receipt.packageName] || receipt.packageName],
        ['From / दिनांक से', fmt(receipt.fromDate)],
        ['To / दिनांक तक', fmt(receipt.toDate)],
        ['Mode / भुगतान', receipt.modeOfPayment === 'online' ? 'Online / ऑनलाइन' : 'Cash / नगद'],
      ].map(([l, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #ddd' }}>
          <span style={{ color: '#555' }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}
      <div style={{ margin: '16px 0', padding: '12px', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 4 }}>
        <div style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Sum of Rupees Paid</div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#222' }}>{words}</div>
      </div>
      <div style={{ textAlign: 'center', padding: '16px', background: '#111', color: 'white', borderRadius: 6, margin: '12px 0' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, opacity: 0.7 }}>AMOUNT PAID</div>
        <div style={{ fontSize: '2rem', fontWeight: 900 }}>₹{receipt.totalAmount}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
        <div style={{ width: 180, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: 8, fontSize: '12px', color: '#555' }}>हस्ताक्षर / Signature<br /><span style={{ fontSize: '11px' }}>(Authorized Signatory)</span></div>
        </div>
      </div>
      {receipt.notes && <div style={{ marginTop: 12, fontSize: '11px', color: '#777' }}>Note: {receipt.notes}</div>}
    </div>
  );
}
