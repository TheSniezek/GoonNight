import { createPortal } from 'react-dom';
import '../styles/LoginModal.scss';
import React from 'react';

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: () => void;
  e621User: string;
  e621ApiKey: string;
  setE621User: (user: string) => void;
  setE621ApiKey: (key: string) => void;
}

export default function LoginModal({
  onClose,
  e621User,
  e621ApiKey,
  setE621User,
  setE621ApiKey,
}: LoginModalProps) {
  const handleSave = () => {
    setE621User(localUser);
    setE621ApiKey(localKey);

    localStorage.setItem('e621User', localUser);
    localStorage.setItem('e621ApiKey', localKey);

    onClose(); // 🔥 TYLKO TO
  };

  const [localUser, setLocalUser] = React.useState(e621User);
  const [localKey, setLocalKey] = React.useState(e621ApiKey);

  return createPortal(
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Login / API Key</h2>

        <div className="login-section">
          <label className="login-row">
            <span className="login-names">Username</span>
            <input value={localUser} onChange={(e) => setLocalUser(e.target.value)} />
          </label>

          <label className="login-row">
            <span className="login-names">API Key</span>
            <input value={localKey} onChange={(e) => setLocalKey(e.target.value)} />
          </label>
        </div>

        <div className="login-buttons">
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
