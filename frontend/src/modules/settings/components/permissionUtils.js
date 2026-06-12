import {
  Settings2, LayoutDashboard, UserCheck, Briefcase, CheckSquare,
  BarChart2, FileText, MessageCircle, DollarSign, Store,
  Globe, UserCog, Users, FolderOpen, Flag, Package, ShoppingCart,
  Activity, Calendar, Mail, MessageSquare, ThumbsUp, MapPin,
  ClipboardList, Layers, Sparkles,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers + data for the Roles & Permissions editor. Kept in a non-JSX file
// (no component exports) so React Fast Refresh stays happy in the matrix module.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Module icons (keyed by registry module.icon) ─────────────────────────────
export const MODULE_ICONS = {
  dashboard:       LayoutDashboard,
  crm:             Users,
  kit:             MessageCircle,
  proposal:        FileText,
  clients:         UserCheck,
  projects:        Briefcase,
  tasks:           CheckSquare,
  pms:             Layers,
  milestones:      Flag,
  site_logs:       ClipboardList,
  site_visits:     MapPin,
  materials:       Package,
  purchase_orders: ShoppingCart,
  activity:        Activity,
  calendar:        Calendar,
  drawings:        FolderOpen,
  mail:            Mail,
  whatsapp:        MessageSquare,
  communication:   Settings2,
  finance:         DollarSign,
  reports:         BarChart2,
  settings:        Settings2,
  users:           UserCog,
  vendor:          Store,
  client_portal:   Globe,
  approvals:       ThumbsUp,
  ai:              Sparkles,
};

// ─── Action / permission helpers ──────────────────────────────────────────────
// An action maps to one OR several permission strings (a merged human capability,
// e.g. "Add" grants the UI-visibility perm + the API-enforced perm together).
export const actionPerms  = (act) => act.permissions || (act.permission ? [act.permission] : []);
export const sectionPerms = (sec) => sec.actions.flatMap(actionPerms);
export const modulePerms  = (mod) => mod.sections.flatMap(sectionPerms);

// An action is "on" only when every underlying permission is held.
export const isActionOn = (act, has) => {
  const perms = actionPerms(act);
  return perms.length > 0 && perms.every(has);
};

// ─── Plain-English help fallback ──────────────────────────────────────────────
const VERB_PHRASES = {
  read: 'See and open', view: 'See', create: 'Add new', upload: 'Upload',
  update: 'Edit', edit: 'Edit', delete: 'Remove', approve: 'Approve',
  send: 'Send', manage: 'Manage', export: 'Export', import: 'Import',
  respond: 'Respond to', release: 'Release', submit: 'Submit',
  reassign: 'Reassign', comment: 'Comment on', dashboard: 'Open the dashboard for',
  assign: 'Assign', baseline: 'Set a baseline for', qualify: 'Qualify', convert: 'Convert',
};
const fallbackHelp = (act, sectionLabel, moduleLabel) => {
  const perm = actionPerms(act)[0] || '';
  if (perm.includes('.tab.')) return `Show the "${act.label}" item in the menu.`;
  const verb = perm.split('.').pop();
  const subject = (sectionLabel || moduleLabel || 'this').toLowerCase();
  const phrase = VERB_PHRASES[verb];
  return phrase ? `${phrase} ${subject}.` : `Controls "${act.label}" in ${moduleLabel}.`;
};
export const helpFor = (act, sectionLabel, moduleLabel) =>
  act.help || fallbackHelp(act, sectionLabel, moduleLabel);

// Filter a module by a search query, returning a trimmed copy (or null).
export const filterModule = (mod, q) => {
  if (!q) return mod;
  const modHit = mod.label.toLowerCase().includes(q) || (mod.description || '').toLowerCase().includes(q);
  if (modHit) return mod;
  const sections = mod.sections
    .map((sec) => {
      const secHit = sec.label.toLowerCase().includes(q);
      if (secHit) return sec;
      const actions = sec.actions.filter(
        (act) => act.label.toLowerCase().includes(q)
          || actionPerms(act).some((p) => p.toLowerCase().includes(q)),
      );
      return actions.length ? { ...sec, actions } : null;
    })
    .filter(Boolean);
  return sections.length ? { ...mod, sections } : null;
};

// ─── Coverage maths ───────────────────────────────────────────────────────────
// The full universe of permission strings the registry knows about. Used to turn
// a role's raw permission count into a "how permissive is this role?" coverage %.
export const flattenCatalogue = (registry = []) => {
  const set = new Set();
  for (const mod of registry)
    for (const sec of mod.sections || [])
      for (const act of sec.actions || [])
        for (const p of actionPerms(act)) set.add(p);
  return set;
};

export const roleCoverage = (permissions = [], registry = []) => {
  const wildcard  = permissions.includes('*');
  const total     = flattenCatalogue(registry).size;
  const granted   = wildcard ? total : Math.min(permissions.length, total || permissions.length);
  const available = Math.max(0, total - granted);
  const pct = wildcard ? 100 : (total ? Math.min(100, Math.round((granted / total) * 100)) : 0);
  return { granted, total, available, pct, wildcard };
};
