import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/notifications/ToastProvider';

const MAX_ROWS = 500;
const MAX_PREVIEW_ROWS = 5;
const MAX_PREVIEW_COLS = 6;

const downloadSample = () => {
  const csv = 'Item,Unit,Qty,Rate\nCement,Bag,50,350\nSand,CFT,100,60\nBricks,Nos,1000,12\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'quotation-template-sample.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const stripExt = (name) => String(name || '').replace(/\.(xlsx|xls|csv)$/i, '').trim() || 'Imported Template';

const detectColumnType = (dataRows, colIndex) => {
  let hasNumeric = false;
  for (const row of dataRows) {
    const cell = row[colIndex];
    if (cell === undefined || cell === null || cell === '') continue;
    const num = Number(String(cell).replace(/,/g, ''));
    if (Number.isNaN(num)) return 'text';
    hasNumeric = true;
  }
  return hasNumeric ? 'number' : 'text';
};

const parseFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('File contains no sheets.'));
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });

        if (!matrix.length) {
          reject(new Error('File is empty.'));
          return;
        }

        const headerRow = (matrix[0] || []).map((v) => String(v ?? '').trim());
        const colCount = headerRow.length;
        if (!colCount) {
          reject(new Error('First row has no column headers.'));
          return;
        }

        const dataRows = matrix
          .slice(1)
          .map((row) =>
            Array.from({ length: colCount }, (_, i) => {
              const v = row[i];
              return typeof v === 'string' ? v.trim() : (v ?? '');
            })
          )
          .filter((row) => row.some((c) => c !== '' && c !== null && c !== undefined));

        if (!dataRows.length) {
          reject(new Error('File has no data rows under the header.'));
          return;
        }
        if (dataRows.length > MAX_ROWS) {
          reject(new Error(`Too many rows (${dataRows.length}). Maximum supported is ${MAX_ROWS}.`));
          return;
        }

        const stamp = Date.now();
        const columns = headerRow.map((label, i) => ({
          id: `c-${stamp}-${i}`,
          label: label || `Column ${i + 1}`,
          type: detectColumnType(dataRows, i),
          width: 'auto',
        }));

        const rows = dataRows.map((row, ri) => ({
          id: `r-${stamp}-${ri}`,
          isGroupHeader: false,
          cells: Object.fromEntries(columns.map((c, ci) => [c.id, row[ci] ?? ''])),
        }));

        resolve({
          structure: { columns, rows },
          headerRow,
          dataRows,
          sheetCount: workbook.SheetNames.length,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });

const ImportTemplateModal = ({ isOpen, onClose, onParsed }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setParseError('');
    setParsed(null);

    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      setParseError('Only CSV and Excel (.xlsx / .xls) files are supported.');
      return;
    }

    setFile(f);
    setIsParsing(true);
    try {
      const result = await parseFile(f);
      setParsed(result);
    } catch (err) {
      setParseError(err?.message || 'Failed to parse file.');
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!parsed || !file) return;
    onParsed({
      structure: parsed.structure,
      suggestedName: stripExt(file.name),
    });
    toast.success('Template loaded for review. Fill in details and save.');
    reset();
  };

  const previewCols = parsed?.headerRow?.slice(0, MAX_PREVIEW_COLS) || [];
  const previewRows = parsed?.dataRows?.slice(0, MAX_PREVIEW_ROWS) || [];
  const totalRowCount = parsed?.dataRows?.length || 0;
  const totalColCount = parsed?.headerRow?.length || 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Quotation Template" className="max-w-3xl">
      <div className="space-y-6">
        {/* Intro + sample */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20">
          <div className="flex items-start gap-3">
            <FileSpreadsheet size={20} className="text-[var(--primary)] shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--text-secondary)]">
              <p className="font-bold text-[var(--text-primary)]">Upload a CSV or Excel file</p>
              <p className="text-xs mt-1">
                The <span className="font-bold">first row</span> becomes the template columns, every row below becomes a template row.
                Only the first sheet is imported (max {MAX_ROWS} rows).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadSample}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline whitespace-nowrap"
          >
            <Download size={14} />
            Sample
          </button>
        </div>

        {/* File picker */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />

          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-[var(--border)] rounded-xl py-10 px-6 flex flex-col items-center justify-center gap-3 hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
            >
              <Upload size={32} className="text-[var(--text-muted)]" />
              <div className="text-center">
                <p className="font-bold text-[var(--text-primary)]">Click to choose a file</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">CSV, XLSX or XLS</p>
              </div>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[var(--text-primary)] truncate">{file.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isParsing
                      ? 'Parsing…'
                      : parsed
                        ? `${totalColCount} cols × ${totalRowCount} rows detected`
                        : 'Failed to parse'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="p-2 rounded-lg hover:bg-[var(--border)] text-[var(--text-secondary)]"
                title="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Multi-sheet warning */}
        {parsed?.sheetCount > 1 && (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50 text-sm">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-900">
              File has {parsed.sheetCount} sheets — only the first sheet was imported.
            </p>
          </div>
        )}

        {/* Parse error */}
        {parseError && (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/5 text-sm">
            <AlertCircle size={18} className="text-[var(--error)] shrink-0 mt-0.5" />
            <p className="text-[var(--text-primary)]">{parseError}</p>
          </div>
        )}

        {/* Preview */}
        {parsed && previewRows.length > 0 && (
          <div className="border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                Preview (first {previewRows.length} of {totalRowCount}
                {totalColCount > MAX_PREVIEW_COLS ? `, showing ${MAX_PREVIEW_COLS} of ${totalColCount} cols` : ''})
              </p>
            </div>
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[var(--surface)] sticky top-0">
                  <tr>
                    {previewCols.map((label, i) => (
                      <th key={i} className="px-3 py-2 font-black text-[var(--text-muted)] whitespace-nowrap">
                        {label || `Column ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="bg-[var(--surface)]">
                      {previewCols.map((_, ci) => (
                        <td key={ci} className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-[180px]">
                          {row[ci] === '' || row[ci] == null ? '—' : String(row[ci])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!parsed || isParsing}
          >
            {isParsing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Parsing
              </>
            ) : (
              <>
                <Upload size={16} />
                Open in Editor
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ImportTemplateModal;
