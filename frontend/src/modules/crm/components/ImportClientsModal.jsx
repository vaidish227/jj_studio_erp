import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const TEMPLATE_COLUMNS = [
  { key: 'name', required: true, example: 'Rajesh Kumar' },
  { key: 'phone', required: true, example: '9876543210' },
  { key: 'email', required: false, example: 'rajesh@example.com' },
  { key: 'projectType', required: false, example: 'Residential' },
  { key: 'source', required: false, example: 'walk_in' },
  { key: 'city', required: false, example: 'Indore' },
  { key: 'area', required: false, example: '2500' },
  { key: 'budget', required: false, example: '1500000' },
  { key: 'siteAddress', required: false, example: '123 MG Road, Indore' },
  { key: 'referredBy', required: false, example: 'Ankit Sharma' },
  { key: 'referrerPhone', required: false, example: '9000000000' },
  { key: 'notes', required: false, example: 'Wants modular kitchen' },
];

// Normalise header keys: lowercase, strip whitespace, map common aliases
const HEADER_ALIASES = {
  'clientname': 'name',
  'fullname': 'name',
  'contactnumber': 'phone',
  'contactmobile': 'phone',
  'mobile': 'phone',
  'emailaddress': 'email',
  'projecttype': 'projectType',
  'enquirytype': 'projectType',
  'leadsource': 'source',
  'approxarea': 'area',
  'sqft': 'area',
  'quotedamount': 'budget',
  'fees': 'budget',
  'sitedetails': 'siteAddress',
  'address': 'siteAddress',
  'referredby': 'referredBy',
  'referrermobile': 'referrerPhone',
  'referrerphone': 'referrerPhone',
};

const normaliseHeader = (header) => {
  const cleaned = String(header || '').toLowerCase().replace(/[\s_-]+/g, '');
  return HEADER_ALIASES[cleaned] || (TEMPLATE_COLUMNS.find(c => c.key.toLowerCase() === cleaned)?.key) || cleaned;
};

const downloadTemplate = () => {
  const headers = TEMPLATE_COLUMNS.map(c => c.key);
  const sampleRow = TEMPLATE_COLUMNS.map(c => c.example);
  const csv = [headers.join(','), sampleRow.map(v => `"${v}"`).join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'client-import-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
          reject(new Error('File contains no sheets'));
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

        if (!raw.length) {
          reject(new Error('File is empty or has no data rows'));
          return;
        }

        // Normalise header keys row-by-row
        const rows = raw.map((row) => {
          const out = {};
          for (const [k, v] of Object.entries(row)) {
            const key = normaliseHeader(k);
            out[key] = typeof v === 'string' ? v.trim() : v;
          }
          return out;
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });

const ImportClientsModal = ({ isOpen, onClose, onImported }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setParseError('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (isUploading) return;
    reset();
    onClose();
  };

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setParseError('');
    setResult(null);
    setParsedRows([]);

    const validExt = /\.(csv|xlsx|xls)$/i.test(f.name);
    if (!validExt) {
      setParseError('Only CSV and Excel (.xlsx / .xls) files are supported.');
      return;
    }

    setFile(f);
    setIsParsing(true);
    try {
      const rows = await parseFile(f);
      setParsedRows(rows);
    } catch (err) {
      setParseError(err?.message || 'Failed to parse file.');
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedRows.length) return;
    setIsUploading(true);
    try {
      const res = await crmService.bulkImportClients(parsedRows);
      setResult(res);
      const created = res?.summary?.created ?? 0;
      const skipped = res?.summary?.skipped ?? 0;
      const errors = res?.summary?.errors ?? 0;
      if (created > 0) {
        toast.success(`Imported ${created} client${created === 1 ? '' : 's'}.${skipped ? ` Skipped ${skipped}.` : ''}${errors ? ` ${errors} error${errors === 1 ? '' : 's'}.` : ''}`);
        onImported?.();
      } else if (skipped > 0 && errors === 0) {
        toast.error(`All ${skipped} row${skipped === 1 ? '' : 's'} already exist — nothing imported.`);
      } else {
        toast.error('Import finished with no new records.');
      }
    } catch (err) {
      const msg = err?.message || 'Failed to import. Please try again.';
      setParseError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const previewRows = parsedRows.slice(0, 5);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Clients"
      className="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Intro + template */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20">
          <div className="flex items-start gap-3">
            <FileSpreadsheet size={20} className="text-[var(--primary)] shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--text-secondary)]">
              <p className="font-bold text-[var(--text-primary)]">Upload a CSV or Excel file</p>
              <p className="text-xs mt-1">
                Required columns: <span className="font-bold">name</span>, <span className="font-bold">phone</span>.
                Rows with duplicate phone or email are skipped automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline whitespace-nowrap"
          >
            <Download size={14} />
            Template
          </button>
        </div>

        {/* File picker / chosen file */}
        {!result && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />

            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border-2 border-dashed border-[var(--border)] rounded-xl py-10 px-6 flex flex-col items-center justify-center gap-3 hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
              >
                <Upload size={32} className="text-[var(--text-muted)]" />
                <div className="text-center">
                  <p className="font-bold text-[var(--text-primary)]">Click to choose a file</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">CSV, XLSX or XLS (max 2000 rows)</p>
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
                      {isParsing ? 'Parsing…' : `${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'} detected`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  disabled={isUploading}
                  className="p-2 rounded-lg hover:bg-[var(--border)] text-[var(--text-secondary)]"
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            )}
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
        {!result && previewRows.length > 0 && (
          <div className="border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                Preview (first {previewRows.length} of {parsedRows.length})
              </p>
            </div>
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[var(--surface)] sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-black text-[var(--text-muted)]">Name</th>
                    <th className="px-3 py-2 font-black text-[var(--text-muted)]">Phone</th>
                    <th className="px-3 py-2 font-black text-[var(--text-muted)]">Email</th>
                    <th className="px-3 py-2 font-black text-[var(--text-muted)]">Project</th>
                    <th className="px-3 py-2 font-black text-[var(--text-muted)]">City</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="bg-[var(--surface)]">
                      <td className="px-3 py-2 font-bold text-[var(--text-primary)]">{row.name || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{row.phone || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-[160px]">{row.email || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{row.projectType || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{row.city || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result summary */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5">
              <CheckCircle2 size={24} className="text-[var(--primary)]" />
              <div>
                <p className="font-bold text-[var(--text-primary)]">Import complete</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Processed {result.summary?.total ?? 0} rows
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <p className="text-3xl font-black text-emerald-700">{result.summary?.created ?? 0}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mt-1">Created</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <p className="text-3xl font-black text-amber-700">{result.summary?.skipped ?? 0}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 mt-1">Skipped</p>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
                <p className="text-3xl font-black text-rose-700">{result.summary?.errors ?? 0}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 mt-1">Errors</p>
              </div>
            </div>

            {(result.skipped?.length > 0 || result.errors?.length > 0) && (
              <div className="border border-[var(--border)] rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg)] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-black text-[var(--text-muted)]">Row</th>
                      <th className="px-3 py-2 font-black text-[var(--text-muted)]">Status</th>
                      <th className="px-3 py-2 font-black text-[var(--text-muted)]">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {(result.skipped || []).map((s, idx) => (
                      <tr key={`s-${idx}`} className="bg-[var(--surface)]">
                        <td className="px-3 py-2 font-bold">{s.row}</td>
                        <td className="px-3 py-2 text-amber-700 font-bold">Skipped</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{s.reason}{s.name ? ` (${s.name})` : ''}</td>
                      </tr>
                    ))}
                    {(result.errors || []).map((e, idx) => (
                      <tr key={`e-${idx}`} className="bg-[var(--surface)]">
                        <td className="px-3 py-2 font-bold">{e.row}</td>
                        <td className="px-3 py-2 text-rose-700 font-bold">Error</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isUploading}
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!parsedRows.length || isParsing}
              isLoading={isUploading}
            >
              {isParsing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Parsing
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Import {parsedRows.length ? `${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'}` : ''}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ImportClientsModal;
