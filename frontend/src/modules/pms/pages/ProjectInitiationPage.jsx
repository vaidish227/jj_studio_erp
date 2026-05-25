import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, User, MapPin, DollarSign, Calendar,
  CheckCircle2, AlertTriangle, ArrowRight, Briefcase,
  FileText, Building2, Ruler,
} from 'lucide-react';
import { Button, Loader, Input, FormField } from '../../../shared/components';
import EmployeePicker from '../components/EmployeePicker';
import useProjectInitiation from '../hooks/useProjectInitiation';

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const fmtCurrency = (n) =>
  n ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
      <Icon size={16} className="text-[var(--primary)]" />
    </div>
    <div>
      <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
    </div>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border)] last:border-0">
    <span className="text-xs font-semibold text-[var(--text-muted)] shrink-0 w-32">{label}</span>
    <span className="text-sm text-[var(--text-primary)] text-right">{value || '—'}</span>
  </div>
);

const TEAM_SLOTS = [
  { field: 'primaryDesigner', label: 'Designer A (Primary)',   desc: 'Client contact & lead designer',         roles: ['designer', 'manager', 'admin'] },
  { field: 'designerB',       label: 'Designer B',             desc: 'Furniture layout & site measurements',   roles: ['designer'] },
  { field: 'designerC',       label: 'Designer C',             desc: 'AC coordination & technical drawings',   roles: ['designer'] },
  { field: 'designerD',       label: 'Designer D',             desc: 'Bathroom & kitchen drawings',            roles: ['designer'] },
  { field: 'designerE',       label: 'Designer E',             desc: 'Concept making & 3D renders',            roles: ['designer'] },
  { field: 'supervisor',      label: 'Supervisor',             desc: 'Site supervision',                       roles: ['supervisor', 'manager'] },
  { field: 'contractor',      label: 'Contractor',             desc: 'Execution contractor',                   roles: ['designer', 'supervisor', 'manager', 'admin'] },
];

const ProjectInitiationPage = () => {
  const { proposalId } = useParams();
  const navigate       = useNavigate();

  const {
    proposal,
    existingProject,
    isLoadingPreview,
    previewError,
    team,
    setTeamMember,
    overrides,
    setOverride,
    isSubmitting,
    submit,
  } = useProjectInitiation(proposalId);

  const handleInitiate = () => {
    submit((project) => {
      navigate(`/projects/${project._id}`);
    });
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoadingPreview) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader label="Loading proposal details..." />
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (previewError || !proposal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle size={40} className="text-[var(--warning)]" />
        <p className="text-sm text-[var(--text-muted)]">Could not load proposal details.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  // ─── Already Initiated ────────────────────────────────────────────────────
  if (existingProject) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[var(--success)]/10 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-[var(--success)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Project Already Exists</h2>
          <p className="text-sm text-[var(--text-muted)]">
            A project has already been initiated for this proposal.
          </p>
          <p className="text-xs font-bold text-[var(--primary)]">{existingProject.trackingId}</p>
          <Button onClick={() => navigate(`/projects/${existingProject._id}`)}>
            Open Project <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>
    );
  }

  const client = proposal.leadId;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto pb-12">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <Link to="/proposal/approved" className="hover:text-[var(--primary)] transition-colors">
          Approved Proposals
        </Link>
        <ChevronRight size={12} />
        <span className="text-[var(--text-primary)] font-semibold truncate max-w-xs">
          Initiate Project
        </span>
      </nav>

      {/* Page Header */}
      <div className="bg-gradient-to-r from-[var(--primary)]/5 to-transparent border border-[var(--primary)]/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--primary)] flex items-center justify-center shrink-0">
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Initiate Project</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Review transferred data and complete project setup before initiating.
            </p>
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)]">
            <CheckCircle2 size={11} /> Proposal Approved
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)]">
            <CheckCircle2 size={11} /> E-Sign Received
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)]">
            <CheckCircle2 size={11} /> Advance Payment Received
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* LEFT: Client & Proposal Data (read-only) */}
        <div className="space-y-6">

          {/* Client Details */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <SectionHeader icon={User} title="Client Details" subtitle="Transferred from CRM" />
            <div className="space-y-0">
              <InfoRow label="Name"        value={client?.name} />
              <InfoRow label="Phone"       value={client?.phone} />
              <InfoRow label="Email"       value={client?.email} />
              <InfoRow label="Project Type" value={client?.projectType} />
              <InfoRow label="Area"        value={client?.area ? `${client.area} sq.ft` : null} />
              <InfoRow label="City"        value={client?.city || client?.siteAddress?.city} />
            </div>
          </div>

          {/* Site Address */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <SectionHeader icon={MapPin} title="Site Address" subtitle="From client profile" />
            <div className="space-y-0">
              <InfoRow label="Full Address"  value={client?.siteAddress?.fullAddress || client?.address} />
              <InfoRow label="Building"      value={client?.siteAddress?.buildingName} />
              <InfoRow label="Tower / Unit"  value={[client?.siteAddress?.tower, client?.siteAddress?.unit].filter(Boolean).join(' / ')} />
              <InfoRow label="Floor"         value={client?.siteAddress?.floor} />
              <InfoRow label="City"          value={client?.siteAddress?.city || client?.city} />
            </div>
          </div>

          {/* Proposal Financials */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <SectionHeader icon={DollarSign} title="Approved Quotation" subtitle="From proposal" />
            <div className="space-y-0">
              <InfoRow label="Proposal Title" value={proposal.title} />
              <InfoRow label="Subtotal"       value={fmtCurrency(proposal.subtotal)} />
              <InfoRow label="GST"            value={proposal.gst ? `${proposal.gst}%` : null} />
              <InfoRow label="Total Amount"   value={fmtCurrency(proposal.finalAmount || proposal.totalAmount)} />
              <InfoRow label="Advance Paid"   value={fmtCurrency(proposal.advancePayment?.amount)} />
            </div>
          </div>
        </div>

        {/* RIGHT: Configuration (editable) */}
        <div className="space-y-6">

          {/* Project Details */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <SectionHeader icon={Building2} title="Project Details" subtitle="Review and adjust as needed" />
            <div className="space-y-4">
              <FormField label="Project Name" required>
                <Input
                  value={overrides.name}
                  onChange={(e) => setOverride('name', e.target.value)}
                  placeholder="e.g. Mehta Villa — 3BHK Redesign"
                />
              </FormField>

              <FormField label="Expected Completion Date">
                <Input
                  type="date"
                  value={overrides.estimatedCompletionDate}
                  onChange={(e) => setOverride('estimatedCompletionDate', e.target.value)}
                />
              </FormField>

              <FormField label="Notes / Special Instructions">
                <textarea
                  value={overrides.notes}
                  onChange={(e) => setOverride('notes', e.target.value)}
                  rows={3}
                  placeholder="Any notes for the project team..."
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                             text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                             focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                             focus:border-[var(--primary)] resize-none transition-colors"
                />
              </FormField>
            </div>
          </div>

          {/* Team Assignment */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <SectionHeader
              icon={User}
              title="Team Assignment"
              subtitle="Assign team members now or update later from the project"
            />
            <div className="space-y-3">
              {TEAM_SLOTS.map(({ field, label, desc, roles }) => (
                <div key={field}>
                  <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                    {label}
                  </label>
                  <EmployeePicker
                    value={team[field]}
                    onChange={(user) => setTeamMember(field, user)}
                    placeholder={`Assign ${label}...`}
                    filterRoles={roles}
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5 ml-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="sticky bottom-0 bg-[var(--surface)] border-t border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg">
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">Ready to initiate?</p>
          <p className="text-xs text-[var(--text-muted)]">
            The project will be created and the proposal will be marked as started.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleInitiate}
            isLoading={isSubmitting}
            disabled={!overrides.name.trim()}
          >
            Initiate Project <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectInitiationPage;
