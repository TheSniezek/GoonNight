import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import '../styles/BlacklistModal.scss';
import type { BlacklistLine } from '../logic/useBlacklist';

interface BlacklistModalProps {
  onClose: () => void;
  blacklistLines: BlacklistLine[];
  onToggle: (lineId: string) => void;
  onAdd: (tags: string) => void;
  onRemove: (lineId: string) => void;
  onEdit: (lineId: string, newTags: string) => void;
  onSave: (lines: BlacklistLine[]) => void;
  loading: boolean;
}

export default function BlacklistModal({
  onClose,
  blacklistLines,
  onToggle,
  onSave,
  loading,
}: BlacklistModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [textareaValue, setTextareaValue] = useState('');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleOpenEdit = () => {
    // Synchronizuj textarea z blacklistLines przy otwieraniu edit mode
    const text = blacklistLines.map((line) => line.tags).join('\n');
    setTextareaValue(text);
    setIsEditMode(true);
  };

  const handleCloseEdit = () => {
    setIsEditMode(false);
  };

  const handleSaveAndClose = async () => {
    if (isEditMode) {
      // Parsuj textarea na blacklist lines
      const lines = textareaValue
        .split('\n')
        .map((tags, index) => ({
          id: `bl-${Date.now()}-${index}`,
          tags: tags.trim(),
          enabled: true,
        }))
        .filter((line) => line.tags.length > 0 && !line.tags.startsWith('#'));

      await onSave(lines);
    } else {
      await onSave(blacklistLines);
    }
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
          {!isEditMode && (
            <button className="blacklist-edit-mode-btn" onClick={handleOpenEdit} disabled={loading}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}

          {isEditMode ? (
            /* EDIT MODE - Textarea */
            <div className="blacklist-edit-mode">
              <p className="blacklist-info">
                Enter tags to blacklist (one per line). Each line will become a toggleable entry.
              </p>
              <textarea
                className="blacklist-textarea"
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
                placeholder="rating:e&#10;gore&#10;scat"
                rows={20}
                disabled={loading}
              />
            </div>
          ) : (
            /* NORMAL MODE - Two columns of checkboxes */
            <div className="blacklist-toggle-mode">
              <p className="blacklist-info">
                Check/uncheck to instantly hide/show posts. Changes are visible immediately.
              </p>

              {blacklistLines.length === 0 ? (
                <div className="blacklist-empty">
                  No blacklist entries. Click "Edit" to add some!
                </div>
              ) : (
                <div className="blacklist-grid">
                  {blacklistLines.map((line) => (
                    <label key={line.id} className="blacklist-checkbox-label">
                      <input
                        type="checkbox"
                        checked={line.enabled}
                        onChange={() => onToggle(line.id)}
                        disabled={loading}
                      />
                      <span className="checkmark"></span>
                      <span className="blacklist-tag-text">{line.tags}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="blacklist-buttons">
          {isEditMode ? (
            <button onClick={handleCloseEdit} disabled={loading}>
              Close
            </button>
          ) : (
            <button onClick={handleSaveAndClose} disabled={loading}>
              {loading ? 'Saving...' : 'Save & Close'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
