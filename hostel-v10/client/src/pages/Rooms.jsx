import React, { useEffect, useState } from 'react';
import { roomsAPI } from '../utils/api';

const COLORS = ['#27ae60','#2980b9','#8e44ad','#f39c12','#c0392b','#795548','#607d8b'];
const LABELS = ['Vacant','1 Member','2 Members','3 Members','4 Members','5 Members','6 Members'];

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    roomsAPI.getAll().then(r => { setRooms(r.data?.data || r.data); setLoading(false); });
  }, []);

  if (loading) return <div style={{color:'var(--text2)',padding:'40px'}}>Loading rooms...</div>;

  const selectedRoom = selected !== null ? rooms.find(r => r.roomNumber === selected) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Room Overview</h2>
          <p>Select a room to view occupants</p>
        </div>
      </div>

      <div className="legend">
        {LABELS.map((l, i) => (
          <div className="legend-item" key={i}>
            <div className="legend-dot" style={{background: COLORS[i]}} />
            {l}
          </div>
        ))}
      </div>

      <div className="rooms-grid">
        {rooms.map(room => (
          <div
            key={room.roomNumber}
            className="room-card"
            data-count={room.memberCount}
            onClick={() => setSelected(room.roomNumber === selected ? null : room.roomNumber)}
            style={{ borderColor: room.roomNumber === selected ? 'var(--accent)' : '' }}
          >
            <div className="room-number" style={{color: COLORS[Math.min(room.memberCount, 6)]}}>
              {String(room.roomNumber).padStart(2, '0')}
            </div>
            <div className="room-badge" data-count={Math.min(room.memberCount, 6)}>
              {room.memberCount}
            </div>
            <div className="room-label">
              {room.memberCount === 0 ? 'Vacant' : room.memberCount === 1 ? '1 Member' : `${room.memberCount} Members`}
            </div>
          </div>
        ))}
      </div>

      {selectedRoom && (
        <div className="card" style={{marginTop: 24}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h3 style={{fontFamily:'Rajdhani'}}>Room {String(selectedRoom.roomNumber).padStart(2,'0')} — Occupants</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
          </div>
          {selectedRoom.members.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏠</div>
              <p>This room is vacant</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Join Date</th>
                    <th>Rent</th>
                    <th>Police Form</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRoom.members.map(m => (
                    <tr key={m._id}>
                      <td style={{color:'var(--text)',fontWeight:500}}>{m.name}</td>
                      <td>{m.mobileNo}</td>
                      <td>{m.roomJoinDate ? new Date(m.roomJoinDate).toLocaleDateString('en-IN') : '—'}</td>
                      <td>₹{m.rent}</td>
                      <td>
                        <span className={`badge ${m.policeFormVerified ? 'badge-green' : 'badge-red'}`}>
                          {m.policeFormVerified ? 'Verified' : 'Pending'}
                        </span>
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
