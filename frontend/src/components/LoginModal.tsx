import { createPortal } from 'react-dom';
import '../styles/LoginModal.scss';
import React, { useState } from 'react';
import type { Account } from '../logic/useAccounts';

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: () => void;
  e621User: string;
  e621ApiKey: string;
  setE621User: (user: string) => void;
  setE621ApiKey: (key: string) => void;
  // multi-account props
  accounts: Account[];
  activeId: string | null;
  onAddOrUpdate: (username: string, apiKey: string, label?: string) => void;
  onSwitch: (id: string) => void;
  onDeleteAccount: (id: string) => void;
}

export default function LoginModal({
  onClose,
  e621User,
  e621ApiKey,
  accounts,
  activeId,
  onAddOrUpdate,
  onSwitch,
  onDeleteAccount,
}: LoginModalProps) {
  const [localUser, setLocalUser] = useState(e621User);
  const [localKey, setLocalKey] = useState(e621ApiKey);
  const [showAddForm, setShowAddForm] = useState(accounts.length === 0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSave = () => {
    const u = localUser.trim();
    const k = localKey.trim();
    if (!u || !k) return;
    onAddOrUpdate(u, k);
    setShowAddForm(false);
    onClose();
  };

  const handleSwitch = (id: string) => {
    if (id === activeId) return;
    onSwitch(id);
    onClose();
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = () => {
    if (confirmDeleteId) {
      onDeleteAccount(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const handleAddNew = () => {
    setLocalUser('');
    setLocalKey('');
    setShowAddForm(true);
  };

  return createPortal(
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Accounts</h2>

        {/* Saved accounts list */}
        {accounts.length > 0 && (
          <div className="accounts-list">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className={`account-item${acc.id === activeId ? ' account-item--active' : ''}`}
                onClick={() => handleSwitch(acc.id)}
                title={acc.id === activeId ? 'Active account' : 'Click to switch'}
              >
                <div className="account-item__info">
                  <span className="account-item__name">{acc.username}</span>
                  {acc.id === activeId && <span className="account-item__badge">active</span>}
                </div>
                <button
                  className="account-item__delete"
                  onClick={(e) => handleDeleteClick(e, acc.id)}
                  title="Remove account"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new account button */}
        {!showAddForm && (
          <button className="login-add-btn" onClick={handleAddNew}>
            + Add account
          </button>
        )}

        {/* Add/edit form */}
        {showAddForm && (
          <div className="login-section">
            <label className="login-row">
              <span className="login-names">Username</span>
              <input value={localUser} onChange={(e) => setLocalUser(e.target.value)} autoFocus />
            </label>
            <label className="login-row">
              <span className="login-names">API Key</span>
              <input
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                type="password"
              />
            </label>
            <div className="login-buttons">
              <button onClick={handleSave} disabled={!localUser.trim() || !localKey.trim()}>
                Save
              </button>
              {accounts.length > 0 && <button onClick={() => setShowAddForm(false)}>Cancel</button>}
            </div>
          </div>
        )}

        {/* Delete confirm dialog */}
        {confirmDeleteId && (
          <div
            className="login-overlay login-overlay--inner"
            onClick={() => setConfirmDeleteId(null)}
          >
            <div className="login-modal login-modal--confirm" onClick={(e) => e.stopPropagation()}>
              <p>
                Remove account{' '}
                <strong>{accounts.find((a) => a.id === confirmDeleteId)?.username}</strong>?
              </p>
              <div className="login-buttons">
                <button onClick={handleDeleteConfirm}>Remove</button>
                <button onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
