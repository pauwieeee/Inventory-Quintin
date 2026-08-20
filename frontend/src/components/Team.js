import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

const EMPTY_ADMIN = { id: null, username: '', password: '', displayName: '' };
const EMPTY_STORE = { id: null, name: '', adminId: '' };
const EMPTY_STAFF = { id: null, username: '', password: '', displayName: '', storeId: '' };

function Team({ stores, setError, setSuccessMsg, refresh, refreshTick }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [storeForm, setStoreForm] = useState(EMPTY_STORE);

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);

  // Password re-confirmation gate for any edit or delete action.
  const [pendingAction, setPendingAction] = useState(null); // { label, run }
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const requestConfirm = (label, run) => {
    setConfirmPassword('');
    setConfirmError('');
    setPendingAction({ label, run });
  };

  const submitConfirm = async () => {
    if (!confirmPassword) {
      setConfirmError('Enter your password');
      return;
    }
    setVerifying(true);
    setConfirmError('');
    try {
      await axios.post(`${API_BASE}/auth/verify-password`, { password: confirmPassword });
      const action = pendingAction;
      setPendingAction(null);
      setConfirmPassword('');
      await action.run();
    } catch (err) {
      setConfirmError(err.response?.data?.error || 'Incorrect password');
    } finally {
      setVerifying(false);
    }
  };

  const load = () => {
    setLoading(true);
    axios.get(`${API_BASE}/team/users`)
      .then((r) => setUsers(r.data))
      .catch((err) => setError('Failed to load team: ' + (err.response?.data?.error || err.message)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const admins = users.filter((u) => u.role === 'admin');
  const staff = users.filter((u) => u.role === 'staff' || u.role === 'store');

  // ---------- Admins ----------
  const openAddAdmin = () => { setAdminForm(EMPTY_ADMIN); setShowAdminModal(true); };
  const openEditAdmin = (a) => { setAdminForm({ id: a.id, username: a.username, password: '', displayName: a.display_name }); setShowAdminModal(true); };

  const saveAdmin = async () => {
    if (adminForm.id) {
      if (!adminForm.displayName || !adminForm.username) return;
      try {
        await axios.put(`${API_BASE}/team/admins/${adminForm.id}`, {
          username: adminForm.username, displayName: adminForm.displayName, password: adminForm.password || undefined
        });
        setSuccessMsg('Admin updated');
        setShowAdminModal(false);
        load();
      } catch (err) {
        setError('Failed to update admin: ' + (err.response?.data?.error || err.message));
      }
    } else {
      if (!adminForm.username || !adminForm.password || !adminForm.displayName) return;
      try {
        await axios.post(`${API_BASE}/team/admins`, adminForm);
        setSuccessMsg('Admin added');
        setShowAdminModal(false);
        load();
      } catch (err) {
        setError('Failed to add admin: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const submitAdminForm = () => {
    if (adminForm.id) requestConfirm(`Save changes to "${adminForm.displayName}"`, saveAdmin);
    else saveAdmin();
  };

  const deleteAdmin = async (a) => {
    try {
      await axios.delete(`${API_BASE}/team/admins/${a.id}`);
      setSuccessMsg('Admin deleted');
      load();
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresForce) {
        const confirmForce = window.confirm(
          `${a.display_name} still owns ${data.storeCount} store(s). Deleting will also permanently delete those stores, all their products, sales, and staff accounts.\n\nContinue with a full force delete?`
        );
        if (confirmForce) {
          try {
            await axios.delete(`${API_BASE}/team/admins/${a.id}?force=true`);
            setSuccessMsg('Admin and everything under them was deleted');
            load();
            refresh();
          } catch (err2) {
            setError('Force delete failed: ' + (err2.response?.data?.error || err2.message));
          }
        }
        return;
      }
      setError('Failed to delete admin: ' + (data?.error || err.message));
    }
  };

  // ---------- Stores ----------
  const openAddStore = () => { setStoreForm(EMPTY_STORE); setShowStoreModal(true); };
  const openEditStore = (s) => { setStoreForm({ id: s.id, name: s.name, adminId: s.admin_id }); setShowStoreModal(true); };

  const saveStore = async () => {
    if (!storeForm.name || !storeForm.adminId) return;
    try {
      if (storeForm.id) {
        await axios.put(`${API_BASE}/stores/${storeForm.id}`, { name: storeForm.name, adminId: storeForm.adminId });
        setSuccessMsg('Store updated');
      } else {
        await axios.post(`${API_BASE}/stores`, { name: storeForm.name, adminId: storeForm.adminId });
        setSuccessMsg('Store added');
      }
      setShowStoreModal(false);
      refresh();
    } catch (err) {
      setError('Failed to save store: ' + (err.response?.data?.error || err.message));
    }
  };

  const submitStoreForm = () => {
    if (storeForm.id) requestConfirm(`Save changes to "${storeForm.name}"`, saveStore);
    else saveStore();
  };

  const deleteStore = async (s) => {
    try {
      await axios.delete(`${API_BASE}/stores/${s.id}`);
      setSuccessMsg('Store deleted');
      refresh();
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresForce) {
        const confirmForce = window.confirm(
          `"${s.name}" still has ${data.productCount} product(s) and ${data.staffCount} staff/store account(s). Deleting will also permanently delete those products, their sales history, and those accounts.\n\nContinue with a full force delete?`
        );
        if (confirmForce) {
          try {
            await axios.delete(`${API_BASE}/stores/${s.id}?force=true`);
            setSuccessMsg('Store and everything under it was deleted');
            refresh();
          } catch (err2) {
            setError('Force delete failed: ' + (err2.response?.data?.error || err2.message));
          }
        }
        return;
      }
      setError('Failed to delete store: ' + (data?.error || err.message));
    }
  };

  // ---------- Staff ----------
  const openAddStaff = () => { setStaffForm(EMPTY_STAFF); setShowStaffModal(true); };
  const openEditStaff = (s) => { setStaffForm({ id: s.id, username: s.username, password: '', displayName: s.display_name, storeId: s.store_id }); setShowStaffModal(true); };

  const saveStaff = async () => {
    if (staffForm.id) {
      if (!staffForm.displayName || !staffForm.storeId || !staffForm.username) return;
      try {
        await axios.put(`${API_BASE}/team/staff/${staffForm.id}`, {
          username: staffForm.username, displayName: staffForm.displayName, password: staffForm.password || undefined, storeId: staffForm.storeId
        });
        setSuccessMsg('Staff updated');
        setShowStaffModal(false);
        load();
      } catch (err) {
        setError('Failed to update staff: ' + (err.response?.data?.error || err.message));
      }
    } else {
      if (!staffForm.username || !staffForm.password || !staffForm.displayName || !staffForm.storeId) return;
      try {
        await axios.post(`${API_BASE}/team/staff`, staffForm);
        setSuccessMsg('Staff added');
        setShowStaffModal(false);
        load();
      } catch (err) {
        setError('Failed to add staff: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const submitStaffForm = () => {
    if (staffForm.id) requestConfirm(`Save changes to "${staffForm.displayName}"`, saveStaff);
    else saveStaff();
  };

  const deleteStaff = async (s) => {
    try {
      await axios.delete(`${API_BASE}/team/staff/${s.id}`);
      setSuccessMsg('Staff account deleted');
      load();
    } catch (err) {
      setError('Failed to delete staff: ' + (err.response?.data?.error || err.message));
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
            <button className="btn btn-black btn-sm" onClick={openAddAdmin}>+ Add Admin</button>
          </div>
          {admins.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, background: '#fafafa', border: '1px solid rgba(0,0,0,0.1)', marginBottom: 6, gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{a.display_name}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{a.username}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="badge badge-black">{stores.filter((s) => s.admin_id === a.id).length} stores</span>
                <button className="btn btn-outline btn-sm" onClick={() => openEditAdmin(a)}>Edit</button>
                <button className="btn btn-outline btn-sm" onClick={() => requestConfirm(`Delete admin "${a.display_name}"`, () => deleteAdmin(a))}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Stores</div>
            <button className="btn btn-black btn-sm" onClick={openAddStore}>+ Add Store</button>
          </div>
          {stores.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, background: '#fafafa', border: '1px solid rgba(0,0,0,0.1)', marginBottom: 6, gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{s.name}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>#{s.id} • Admin: {s.admin_name}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => openEditStore(s)}>Edit</button>
                <button className="btn btn-outline btn-sm" onClick={() => requestConfirm(`Delete store "${s.name}"`, () => deleteStore(s))}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Staff Accounts</div>
            <button className="btn btn-black btn-sm" onClick={openAddStaff}>+ Add Staff</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Username</th><th>Display</th><th>Store</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.username}</td>
                    <td>{s.display_name}</td>
                    <td>{stores.find((st) => st.id === s.store_id)?.name || s.store_id}</td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEditStaff(s)}>Edit</button>
                        <button className="btn btn-outline btn-sm" onClick={() => requestConfirm(`Delete staff account "${s.display_name}"`, () => deleteStaff(s))}>🗑</button>
                      </div>
                    </td>
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
            <div className="modal-title" style={{ marginBottom: 12 }}>{adminForm.id ? 'Edit Admin' : 'Add Admin'}</div>
            <div className="form-group"><input placeholder="Username" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} /></div>
            <div className="form-group">
              <input placeholder={adminForm.id ? 'New Password (leave blank to keep)' : 'Password'} value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
            </div>
            <div className="form-group"><input placeholder="Display Name" value={adminForm.displayName} onChange={(e) => setAdminForm({ ...adminForm, displayName: e.target.value })} /></div>
            <button className="btn btn-black" style={{ width: '100%', justifyContent: 'center' }} onClick={submitAdminForm}>{adminForm.id ? 'Save Changes' : 'Add'}</button>
          </div>
        </div>
      )}

      {showStoreModal && (
        <div className="modal-overlay" onClick={() => setShowStoreModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ marginBottom: 12 }}>{storeForm.id ? 'Edit Store' : 'Add Store'}</div>
            <div className="form-group"><input placeholder="Store Name" value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} /></div>
            <div className="form-group">
              <select value={storeForm.adminId} onChange={(e) => setStoreForm({ ...storeForm, adminId: e.target.value })}>
                <option value="">Select admin</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
              </select>
            </div>
            <button className="btn btn-black" style={{ width: '100%', justifyContent: 'center' }} onClick={submitStoreForm}>{storeForm.id ? 'Save Changes' : 'Add Store'}</button>
          </div>
        </div>
      )}

      {showStaffModal && (
        <div className="modal-overlay" onClick={() => setShowStaffModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ marginBottom: 12 }}>{staffForm.id ? 'Edit Staff Account' : 'Add Staff Account'}</div>
            <div className="form-group"><input placeholder="Username" value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} /></div>
            <div className="form-group">
              <input placeholder={staffForm.id ? 'New Password (leave blank to keep)' : 'Password'} value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} />
            </div>
            <div className="form-group"><input placeholder="Display Name" value={staffForm.displayName} onChange={(e) => setStaffForm({ ...staffForm, displayName: e.target.value })} /></div>
            <div className="form-group">
              <select value={staffForm.storeId} onChange={(e) => setStaffForm({ ...staffForm, storeId: e.target.value })}>
                <option value="">Select store</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button className="btn btn-black" style={{ width: '100%', justifyContent: 'center' }} onClick={submitStaffForm}>{staffForm.id ? 'Save Changes' : 'Add Staff'}</button>
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="modal-overlay" onClick={() => setPendingAction(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ marginBottom: 4 }}>🔒 Confirm Your Password</div>
            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>{pendingAction.label}</p>
            <div className="form-group">
              <input
                type="password"
                placeholder="Your Host password"
                value={confirmPassword}
                autoFocus
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitConfirm()}
              />
            </div>
            {confirmError && <div className="login-error" style={{ marginBottom: 12 }}>{confirmError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPendingAction(null)}>Cancel</button>
              <button className="btn btn-black" style={{ flex: 1, justifyContent: 'center' }} onClick={submitConfirm} disabled={verifying}>
                {verifying ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Team;
