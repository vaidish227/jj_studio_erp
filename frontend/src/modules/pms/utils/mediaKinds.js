// Shared media-kind config + helpers for the closure modules' file pickers.
// A file's "kind" (image | audio | video | document) is auto-detected from its
// MIME type, so the user just drops files and we route each to the right
// per-kind upload call.

const DOC_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
  'application/zip', 'application/x-zip-compressed',
];
const DOC_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.zip'];

export const KIND_CONFIG = {
  image:    { label: 'Images',    accept: 'image/jpeg,image/jpg,image/png,image/webp', maxBytes: 15 * 1024 * 1024 },
  document: { label: 'Documents', accept: [...DOC_MIME, ...DOC_EXT].join(','),          maxBytes: 25 * 1024 * 1024 },
  audio:    { label: 'Audio',     accept: 'audio/*',                                    maxBytes: 25 * 1024 * 1024 },
  video:    { label: 'Video',     accept: 'video/*',                                    maxBytes: 100 * 1024 * 1024 },
};

/** Auto-detect a file's kind from its MIME type (extension fallback for docs). */
export const detectKind = (file) => {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) return 'video';
  if (DOC_MIME.includes(t)) return 'document';
  const ext = `.${(file.name || '').split('.').pop().toLowerCase()}`;
  if ((!t || t === 'application/octet-stream') && DOC_EXT.includes(ext)) return 'document';
  return 'document';
};

/** Combined accept attribute for an input that takes any of the given kinds. */
export const acceptFor = (kinds) =>
  [...new Set(kinds.flatMap((k) => (KIND_CONFIG[k]?.accept || '').split(',')))].filter(Boolean).join(',');

/**
 * Validate a file against the allowed kinds. Returns { ok, kind, error }.
 */
export const validateFile = (file, kinds) => {
  const kind = detectKind(file);
  if (!kinds.includes(kind)) {
    return { ok: false, kind, error: `"${file.name}" is not an accepted ${kinds.map((k) => KIND_CONFIG[k]?.label || k).join('/')} file.` };
  }
  const max = KIND_CONFIG[kind].maxBytes;
  if (file.size > max) {
    return { ok: false, kind, error: `"${file.name}" exceeds the ${Math.round(max / 1048576)} MB limit for ${KIND_CONFIG[kind].label}.` };
  }
  return { ok: true, kind, error: null };
};

export const formatSize = (n) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

/**
 * Group files by detected kind and upload each group via `uploadFn(formData)`.
 * Each FormData carries `kind` + its `files[]`. Returns the array of responses.
 */
export const uploadGroupedFiles = async (files, uploadFn) => {
  const groups = {};
  for (const f of files) {
    const k = detectKind(f);
    (groups[k] ||= []).push(f);
  }
  const responses = [];
  for (const [kind, list] of Object.entries(groups)) {
    const fd = new FormData();
    fd.append('kind', kind);
    list.forEach((f) => fd.append('files', f, f.name));
    // eslint-disable-next-line no-await-in-loop
    responses.push(await uploadFn(fd));
  }
  return responses;
};
