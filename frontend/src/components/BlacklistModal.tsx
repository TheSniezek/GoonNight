import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import '../styles/BlacklistModal.scss';

interface BlacklistModalProps {
  onClose: () => void;
  blacklist: string;
  onSave: (newBlacklist: string) => void;
  loading: boolean;
}

export default function BlacklistModal({
  onClose,
  blacklist,
  onSave,
  loading,
}: BlacklistModalProps) {
  const [localBlacklist, setLocalBlacklist] = useState(blacklist);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleSave = () => {
    onSave(localBlacklist);
    onClose();
  };

  return createPortal(
    <div className="blacklist-overlay" onClick={onClose}>
      <div className="blacklist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="blacklist-top-bar">
          <button className="blacklist-close" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span className="blacklist-title">Blacklist</span>
        </div>

        <div className="blacklist-content">
          <p className="blacklist-info">
            Enter tags to blacklist (one per line). Posts matching these tags will be hidden.
          </p>
          <textarea
            className="blacklist-textarea"
            value={localBlacklist}
            onChange={(e) => setLocalBlacklist(e.target.value)}
            placeholder="rating:e&#10;gore&#10;scat"
            rows={15}
            disabled={loading}
          />
        </div>

        <div className="blacklist-buttons">
          <button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
