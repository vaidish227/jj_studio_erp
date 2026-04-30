import React from 'react';
import { CheckCircle2, Clock, Mail, PenTool, CreditCard, UserPlus } from 'lucide-react';
import Card from '../../../../shared/components/Card/Card';

const StatusTracker = ({ currentStatus }) => {
  const steps = [
    { id: 'draft', label: 'Draft', icon: Clock },
    { id: 'approval', label: 'Approval', icon: CheckCircle2 },
    { id: 'sent', label: 'Sent', icon: Mail },
    { id: 'esign', label: 'eSign', icon: PenTool },
    { id: 'payment', label: 'Payment', icon: CreditCard },
    { id: 'converted', label: 'Converted', icon: UserPlus },
  ];

  const currentIdx = steps.findIndex(s => s.id === currentStatus) || 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-2 relative z-10">
                <div 
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500
                    ${isCompleted ? 'bg-[var(--success)] text-white' : 
                      isActive ? 'bg-[var(--primary)] text-black ring-4 ring-[var(--primary)]/20' : 
                      'bg-[var(--surface)] border-2 border-[var(--border)] text-[var(--text-muted)]'}
                  `}
                >
                  <Icon size={20} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                  {step.label}
                </span>
              </div>
              
              {idx < steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 bg-[var(--border)] rounded-full relative -top-3 overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-[var(--primary)] transition-all duration-700 ease-out"
                    style={{ width: idx < currentIdx ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </Card>
  );
};

export default StatusTracker;
