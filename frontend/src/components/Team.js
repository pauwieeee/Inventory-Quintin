import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

function Team({ stores, setError, setSuccessMsg, refresh, refreshTick }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ username: '', password: '', displayName: '' });

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [storeForm, setStoreForm] = useState({ name: '', adminId: '' });

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ username: '', password: '', displayName: '', storeId: '' });

  const load = () => {
    setLoading(true);
    axios.get(`${API_BASE}/team/users`)
      .then((r) => setUsers(r.data))
      .catch((err) => setError('Failed to load team: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const admins = users.filter((u) => u.role === 'admin');
  const staff = users.filter((u) => u.role === 'staff');

  const addAdmin = async () => {
    if (!adminForm.username || !adminForm.password || !adminForm.displayName) return;
    try {
      await axios.post(`${API_BASE}/team/admins`, adminForm);
      setSuccessMsg('Admin added');
      setShowAdminModal(false);
      setAdminForm({ username: '', password: '', displayName: '' });
      load();
    } catch (err) {
      setError('Failed to add admin: ' + (err.response?.data?.error || err.message));
    }
  };

  const addStore = async () => {
    if (!storeForm.name || !storeForm.adminId) return;
    try {
      await axios.post(`${API_BASE}/stores`, storeForm);
      setSuccessMsg('Store added');
      setShowStoreModal(false);
      setStoreForm({ name: '', adminId: '' });
      refresh();
    } catch (err) {
      setError('Failed to add store: ' + (err.response?.data?.error || err.message));
    }
  };

  const addStaff = async () => {
    if (!staffForm.username || !staffForm.password || !staffForm.displayName || !staffForm.storeId) return;
    try {
      await axios.post(`${API_BASE}/team/staff`, staffForm);
      setSuccessMsg('Staff added');
      setShowStaffModal(false);
      setStaffForm({ username: '', password: '', displayName: '', storeId: '' });
      load();
    } catch (err) {
      setError('Failed to add staff: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div className="spinner-container"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-head">
        <div className="page-title">Team Management • Host Only</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div className="panel">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Admins</div>
            <button className="btn btn-black btn-sm" onClick={() => setShowAdminModal(true)}>+ Add Admin</button>
          </div>
          {admins.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderRadius: 10, background: '#fafafa', border: '1px solid rgba(0,0,0,0.1)', marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{a.display_name}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{a.username}</div>
              </div>
              <span className="badge badge-black">{stores.filter((s) => s.admin_id === a.id).length} stores</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Stores</div>
            <button className="btn btn-black btn-sm" onClick={() => setShowStoreModal(true)}>+ Add Store</button>
          </div>
          {stores.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderRadius: 10, background: '#fafafa', border: '1px solid rgba(0,0,0,0.1)', marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{s.name}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>#{s.id} • Admin: {s.admin_name}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Staff Accounts</div>
            <button className="btn btn-black btn-sm" onClick={() => setShowStaffModal(true)}>+ Add Staff</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Username</th><th>Display</th><th>Store</th></tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.username}</td>
                    <td>{s.display_name}</td>
                    <td>{stores.find((st) => st.id === s.store_id)?.name || s.store_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ marginBottom: 12 }}>Add Admin</div>
            <div className="form-group"><input placeholder="Username" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} /></div>
            <div className="form-group"><input placeholder="Password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} /></div>
            <div className="form-group"><input placeholder="Display Name" value={adminForm.displayName} onChange={(e) => setAdminForm({ ...adminForm, displayName: e.target.value })} /></div>
            <button className="btn btn-black" style={{ width: '100%', justifyContent: 'center' }} onClick={addAdmin}>Add</button>
          </div>
        </div>
      )}

      {showStoreModal && (
        <div className="modal-overlay" onClick={() => setShowStoreModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ marginBottom: 12 }}>Add Store</div>
            <div className="form-group"><input placeholder="Store Name" value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} /></div>
            <div className="form-group">
              <select value={storeForm.adminId} onChange={(e) => setStoreForm({ ...storeForm, adminId: e.target.value })}>
                <option value="">Select admin</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
              </select>
            </div>
            <button className="btn btn-black" style={{ width: '100%', justifyContent: 'center' }} onClick={addStore}>Add Store</button>
          </div>
        </div>
      )}

      {showStaffModal && (
        <div className="modal-overlay" onClick={() => setShowStaffModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ marginBottom: 12 }}>Add Staff Account</div>
            <div className="form-group"><input placeholder="Username" value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} /></div>
            <div className="form-group"><input placeholder="Password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} /></div>
            <div className="form-group"><input placeholder="Display Name" value={staffForm.displayName} onChange={(e) => setStaffForm({ ...staffForm, displayName: e.target.value })} /></div>
            <div className="form-group">
              <select value={staffForm.storeId} onChange={(e) => setStaffForm({ ...staffForm, storeId: e.target.value })}>
                <option value="">Select store</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button className="btn btn-black" style={{ width: '100%', justifyContent: 'center' }} onClick={addStaff}>Add Staff</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Team;
