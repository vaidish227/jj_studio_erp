import { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Modal, Button } from '../../../shared/components';

const ResetPasswordModal = ({ isOpen, onClose, user, onReset, isResetting }) => {
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirm]     = useState('');
  const [showNew, setShowNew]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [errors, setErrors]               = useState({});

  if (!user) return null;

  const handleClose = () => {
    setNewPassword('');
    setConfirm('');
    setErrors({});
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!newPassword)           errs.newPassword = 'Password is required';
    else if (newPassword.length < 6) errs.newPassword = 'Must be at least 6 characters';
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onReset(user._id, newPassword);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Reset Password">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* User context */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)]">
          <div className="w-9 h-9 rounded-lg bg-[var(--warning)]/10 flex items-center justify-center shrink-0">
            <ShieldAlert size={18} className="text-[var(--warning)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
          </div>
        </div>

        {/* New password */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            New Password
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <KeyRound size={15} />
            </div>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setErrors((p) => ({ ...p, newPassword: '' })); }}
              placeholder="Minimum 6 characters"
              className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-sm bg-[var(--surface)] text-[var(--text-primary)] outline-none transition-colors
                ${errors.newPassword ? 'border-[var(--error)]' : 'border-[var(--border)] focus:border-[var(--primary)]'}`}
            />
            <button
              type="button"
              onClick={() => setShowNew((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {errors.newPassword && <p className="text-xs text-[var(--error)]">{errors.newPassword}</p>}
        </div>

        {/* Confirm password */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <KeyRound size={15} />
            </div>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirmPassword: '' })); }}
              placeholder="Repeat the new password"
              className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-sm bg-[var(--surface)] text-[var(--text-primary)] outline-none transition-colors
                ${errors.confirmPassword ? 'border-[var(--error)]' : 'border-[var(--border)] focus:border-[var(--primary)]'}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-[var(--error)]">{errors.confirmPassword}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-[var(--border)]">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isResetting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isResetting}>
            <KeyRound size={14} className="mr-1.5" />
            Reset Password
          </Button>
        </div>

      </form>
    </Modal>
  );
};

export default ResetPasswordModal;
