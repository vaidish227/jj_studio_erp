import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import PreviewDrawingModal from './PreviewDrawingModal';
import RequestRevisionModal from './RequestRevisionModal';

const isPdfFile = (d) => {
  const t = (d?.fileType || '').toLowerCase();
  if (t.includes('pdf')) return true;
  return (d?.fileName || '').toLowerCase().endsWith('.pdf');
};

/**
 * RequestRevisionFlow — markup-first revision request.
 *
 * Step 1 (editor): the task's submitted drawing opens in the annotation
 *   editor so the reviewer marks exactly what must change. Annotations
 *   persist on the drawing and are visible to the designer.
 * Step 2 (form): instructions + optional deadline (RequestRevisionModal),
 *   with a "Back to drawing" escape hatch.
 *
 * Tasks with no annotatable (non-PDF) drawing skip straight to the form.
 * Drop-in replacement for RequestRevisionModal — same props.
 */
const RequestRevisionFlow = ({ task, isOpen, onClose, onRevisionRequested }) => {
  const [step, setStep] = useState('loading'); // loading | editor | form
  const [drawing, setDrawing] = useState(null);

  useEffect(() => {
    if (!isOpen || !task?._id) return undefined;
    let cancelled = false;
    setStep('loading');
    setDrawing(null);
    pmsService.getDrawingsByTask(task._id)
      .then((res) => {
        if (cancelled) return;
        const annotatable = (res?.drawings || []).filter((d) => !isPdfFile(d));
        const candidate =
          annotatable.find((d) => d.status === 'sent_for_approval') || annotatable[0];
        if (candidate) { setDrawing(candidate); setStep('editor'); }
        else setStep('form');
      })
      .catch(() => { if (!cancelled) setStep('form'); });
    return () => { cancelled = true; };
  }, [isOpen, task?._id]);

  if (!isOpen || !task) return null;

  return (
    <>
      {step === 'loading' && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-white" />
        </div>
      )}

      {drawing && (
        <PreviewDrawingModal
          drawing={drawing}
          isOpen={step === 'editor'}
          onClose={onClose}
          revisionMode
          onProceedToRevision={() => setStep('form')}
        />
      )}

      <RequestRevisionModal
        task={task}
        isOpen={step === 'form'}
        onClose={onClose}
        onRevisionRequested={onRevisionRequested}
        onBack={drawing ? () => setStep('editor') : undefined}
      />
    </>
  );
};

export default RequestRevisionFlow;
