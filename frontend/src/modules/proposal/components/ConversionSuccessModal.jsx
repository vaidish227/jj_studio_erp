import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, FolderOpen, ArrowRight, Sparkles } from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';

const ConversionSuccessModal = ({ isOpen, onClose, project, clientName }) => {
  const navigate = useNavigate();

  const handleGoToProject = () => {
    onClose();
    navigate(`/projects/${project?._id}`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={null} className="max-w-md">
      <div className="flex flex-col items-center text-center py-4 space-y-6">
        {/* Icon burst */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
            <CheckCircle2 size={40} className="text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center shadow-lg">
            <Sparkles size={14} className="text-black" />
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">
            Client Converted!
          </h2>
          <p className="text-[var(--text-muted)] font-medium text-sm">
            {clientName ? (
              <><span className="font-bold text-[var(--text-primary)]">{clientName}</span> has officially signed. A new project has been created.</>
            ) : (
              'The proposal has been signed. A new project has been created.'
            )}
          </p>
        </div>

        {/* Project card */}
        {project && (
          <div className="w-full p-5 bg-[var(--bg)] border-2 border-[var(--primary)]/30 rounded-2xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                <FolderOpen size={20} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">New Project Created</p>
                <p className="text-sm font-black text-[var(--text-primary)]">{project.name || 'Interior Project'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-[var(--text-muted)] font-bold">Tracking ID</span>
              <span className="text-xs font-black text-[var(--primary)] bg-[var(--primary)]/10 px-3 py-1 rounded-full">
                {project.trackingId}
              </span>
            </div>
          </div>
        )}

        {/* Info note */}
        <p className="text-xs text-[var(--text-muted)] font-medium px-2">
          The client's lifecycle has been updated to <span className="font-bold text-[var(--text-primary)]">Converted</span>.
          You can now manage their project from the PMS dashboard.
        </p>

        {/* Actions */}
        <div className="flex flex-col w-full gap-3 pt-2">
          <Button
            onClick={handleGoToProject}
            className="w-full flex items-center justify-center gap-2"
          >
            Go to Project
            <ArrowRight size={16} />
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Stay on Approvals
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConversionSuccessModal;
