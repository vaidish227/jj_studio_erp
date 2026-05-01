import React from 'react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';

const TemplatePreviewModal = ({ isOpen, onClose, template }) => {
  if (!template) return null;
  const { structure } = template;
  const columns = structure?.columns || [];
  const rows = structure?.rows || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Template Preview" size="xl">
      <div className="space-y-6">
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-2xl font-black text-[var(--text-primary)] underline underline-offset-4">{template.name || 'Untitled Template'}</h2>
          {template.description && <p className="text-[var(--text-muted)] text-sm">{template.description}</p>}
        </div>

        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[var(--bg)]">
                <tr>
                  <th className="px-4 py-3 border-b border-r border-[var(--border)] font-bold text-[var(--text-muted)] uppercase tracking-wider text-[10px] whitespace-nowrap w-12 text-center">
                    #
                  </th>
                  {columns.map((col) => (
                    <th key={col.id} className="px-4 py-3 border-b border-r border-[var(--border)] font-bold text-[var(--text-primary)] uppercase tracking-wider text-[11px] whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-[var(--text-muted)] italic">
                      Empty template structure
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rIdx) => (
                    <tr key={row.id} className={row.isGroupHeader ? 'bg-[var(--primary)]/5' : 'hover:bg-[var(--bg)]'}>
                      <td className="px-4 py-3 text-[var(--text-muted)] font-medium text-[11px] text-center border-b border-r border-[var(--border)]">
                        {rIdx + 1}
                      </td>
                      {row.isGroupHeader ? (
                        <td colSpan={columns.length} className="px-4 py-3 border-b border-[var(--border)] font-black text-[var(--primary)] uppercase tracking-wide text-xs">
                          {row.cells[columns[0]?.id] || 'Unnamed Group'}
                        </td>
                      ) : (
                        columns.map(col => (
                          <td key={col.id} className={`px-4 py-3 border-b border-r border-[var(--border)] text-[var(--text-secondary)] font-medium ${col.type === 'number' ? 'text-right' : ''}`}>
                            {row.cells[col.id] || '-'}
                          </td>
                        ))
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="flex justify-end pt-4 border-t border-[var(--border)]">
          <Button variant="outline" onClick={onClose}>Close Preview</Button>
        </div>
      </div>
    </Modal>
  );
};

export default TemplatePreviewModal;
