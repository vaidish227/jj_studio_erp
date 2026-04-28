import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  Home,
  Briefcase,
  Calendar,
  MapPin,
  Baby,
  Heart,
  AlertCircle,
  Pencil,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import FormField from '../../../shared/components/FormField/FormField';
import Input from '../../../shared/components/Input/Input';
import Button from '../../../shared/components/Button/Button';
import { useCRM } from '../context/CRMContext';
import useClientInfo from '../../../shared/hooks/useClientInfo';

/* ─── Skeleton loader shown while fetching existing client data ─── */
const FieldSkeleton = () => (
  <div className="space-y-2">
    <div className="h-3 w-24 rounded bg-[var(--border)] animate-pulse" />
    <div className="h-10 w-full rounded-xl bg-[var(--border)] animate-pulse" />
  </div>
);

const FetchingOverlay = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: 9 }).map((_, i) => (
      <FieldSkeleton key={i} />
    ))}
  </div>
);

/* ─── Main Component ──────────────────────────────────────────────── */
const ClientInfoFormPage = ({ isPublic = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeLead, setActiveLead, clearActiveLead, setCrmState } = useCRM();

  // Pull both leadId AND clientId from navigation state
  const stateLeadId   = location.state?.leadId  ?? null;
  const stateClientId = location.state?.clientId ?? null;

  // Extract stable primitives from location.state to use as effect deps.
  // Using location.state directly causes infinite loops (new object ref each render).
  const stateName  = location.state?.name  ?? '';
  const statePhone = location.state?.phone ?? '';
  const stateEmail = location.state?.email ?? '';

  const leadContext = stateLeadId ? location.state : activeLead;

  React.useEffect(() => {
    if (stateLeadId) {
      setActiveLead({
        id:    stateLeadId,
        _id:   stateLeadId,
        name:  stateName,
        phone: statePhone,
        email: stateEmail,
      });
    }
  // setActiveLead is stable after wrapping in useCallback in CRMContext.
  // Primitives (string/null) are safe as deps — no infinite loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateLeadId, stateName, statePhone, stateEmail]);

  const {
    formData,
    errors,
    isLoading,
    isFetching,
    apiError,
    isSuccess,
    isUpdate,
    handleChange,
    submitClientInfo,
  } = useClientInfo({
    activeLead: leadContext,
    clientId:   stateClientId,
    onSuccess: () => {
      setCrmState((prev) => ({ ...prev, lastStep: 'client_info_submitted' }));
    },
  });

  // Edit mode: new clients start editable; existing clients start in view mode
  const [isEditing, setIsEditing] = useState(!stateClientId);
  // Success state management
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdateSuccess(false);
    const client = await submitClientInfo();
    if (client) {
      if (isUpdate) {
        // Show success and return to Lead Details page after a short delay
        setUpdateSuccess(true);
        setIsEditing(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        setTimeout(() => {
          navigate(`/crm/leads/${stateLeadId || activeLead?._id || activeLead?.id}`);
        }, 1500);
      } else {
        // First-time creation → show success screen and redirect if internal
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (!isPublic) {
          setTimeout(() => {
            navigate(`/crm/leads/${stateLeadId || activeLead?._id || activeLead?.id}`);
          }, 2000);
        }
      }
    }
  };

  /* ── Success screen (first-time creation only) ─────────────────── */
  if (isSuccess && !isUpdate) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4">
        <Card className="text-center py-16 space-y-6 shadow-2xl border-t-4 border-t-[var(--success)]">
          <div className="w-20 h-20 bg-[var(--success)]/10 text-[var(--success)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Information Saved!</h1>
          <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto">
            Client information has been successfully submitted and linked to the lead.
          </p>
          {!isPublic && (
            <Button variant="primary" onClick={() => navigate('/crm/qualified')}>
              Go To KIT Stage
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const inputCls = (disabled) =>
    disabled
      ? 'opacity-60 pointer-events-none cursor-default'
      : '';

  return (
    <div className={`mx-auto space-y-8 py-4 px-4 ${isPublic ? 'max-w-5xl' : 'max-w-6xl'}`}>

      {/* ── Lead Context Banner ─────────────────────────────────────── */}
      {leadContext && !isPublic && (
        <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-2xl p-4 flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
          <div className="w-12 h-12 bg-[var(--primary)]/20 border border-[var(--primary)]/30 rounded-xl flex items-center justify-center text-[var(--primary)] font-bold shrink-0">
            <User size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[var(--primary)] uppercase tracking-widest">
              {isUpdate ? 'Editing Client' : 'Active Onboarding'}
            </p>
            <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
              {isUpdate ? 'Update: ' : 'Onboarding: '}{leadContext.name}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {leadContext.phone} • {leadContext.email}
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => {
              // 1. Clear CRM Context
              clearActiveLead();
              // 2. Clear Navigation State (by navigating to self without state)
              navigate('/crm/forms/client-info', { replace: true, state: null });
              // 3. The useClientInfo hook will naturally reset because leadId becomes null
            }}
            className="group flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all"
            title="Clear context and start fresh"
          >
            <span className="text-xs font-bold uppercase hidden sm:inline">Cancel Onboarding</span>
            <X size={18} className="group-hover:rotate-90 transition-transform" />
          </button>
        </div>
      )}

      {/* ── Page Header ───────────────────────────────────────────── */}
      {!isPublic && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              {isUpdate ? 'Client Information' : 'Client Information Form'}
            </h1>
            <p className="text-[var(--text-secondary)] font-medium">
              {isUpdate
                ? isEditing
                  ? 'Edit and save the client profile below.'
                  : 'Viewing saved client profile. Click Edit to make changes.'
                : 'Complete profile for project onboarding.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Edit / Cancel-edit toggle — only for existing clients */}
            {isUpdate && !isFetching && (
              isEditing ? (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => { setIsEditing(false); setUpdateSuccess(false); }}
                  className="text-[var(--text-muted)]"
                >
                  <X size={16} />
                  Cancel Edit
                </Button>
              ) : (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => { setIsEditing(true); setUpdateSuccess(false); }}
                >
                  <Pencil size={16} />
                  Edit Info
                </Button>
              )
            )}

            {/* Date field — only show when editable */}
            {isEditing && (
              <Input
                label="Form Date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                icon={Calendar}
                className="md:w-64"
              />
            )}
          </div>
        </div>
      )}

      {isPublic && (
        <div className="text-center space-y-2 mb-10">
          <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight">
            Onboarding Details
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            Please fill out the form below to help us understand your requirements better.
          </p>
        </div>
      )}

      {/* ── Update success banner ──────────────────────────────────── */}
      {updateSuccess && (
        <div className="flex items-center gap-3 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-2xl px-5 py-4 text-[var(--success)] font-medium animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 size={20} className="shrink-0" />
          <span>Client information updated successfully.</span>
        </div>
      )}

      {/* ── Fetching skeleton ──────────────────────────────────────── */}
      {isFetching ? (
        <div className="space-y-8">
          <div className="flex items-center gap-3 text-[var(--text-muted)] py-2">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading existing client data…</span>
          </div>
          <FetchingOverlay />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-10">

          {/* ── Section 1: Primary Client ──────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-[var(--primary)] mb-2">
              <div className="p-2 rounded-lg bg-[var(--primary)]/10">
                <User size={24} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-tight">Primary Client Details</h2>
            </div>

            <Card className={`shadow-sm hover:shadow-md transition-shadow ${!isEditing ? 'bg-[var(--bg)]' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Input
                  label="Full Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={errors.name}
                  icon={User}
                  placeholder="Required"
                  required
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Contact Number"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  error={errors.contactNumber}
                  icon={Phone}
                  placeholder="Required"
                  required
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  icon={Mail}
                  placeholder="Required"
                  required
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Date of Birth"
                  name="dob"
                  type="date"
                  value={formData.dob}
                  onChange={handleChange}
                  icon={Calendar}
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Company Name"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  icon={Briefcase}
                  placeholder="Optional"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <FormField label="Present Residential Address">
                  <div className="relative">
                    <Home className="absolute left-4 top-3 text-[var(--text-muted)]" size={18} />
                    <textarea
                      name="residentialAddress"
                      value={formData.residentialAddress}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full pl-12 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none min-h-[80px] text-sm ${inputCls(!isEditing)}`}
                      placeholder="Complete residential address..."
                    />
                  </div>
                </FormField>
                <FormField label="Office Address (if any)">
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-3 text-[var(--text-muted)]" size={18} />
                    <textarea
                      name="officeAddress"
                      value={formData.officeAddress}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full pl-12 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none min-h-[80px] text-sm ${inputCls(!isEditing)}`}
                      placeholder="Complete office address..."
                    />
                  </div>
                </FormField>
              </div>
            </Card>
          </section>

          {/* ── Section 2: Spouse / Partner ───────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-[var(--accent-blue)] mb-2">
              <div className="p-2 rounded-lg bg-[var(--accent-blue)]/10">
                <Heart size={24} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-tight">Spouse/Partner Details</h2>
            </div>

            <Card className={`shadow-sm border-l-4 border-l-[var(--accent-blue)] ${!isEditing ? 'bg-[var(--bg)]' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Input
                  label="Spouse/Partner Name"
                  name="spouseName"
                  value={formData.spouseName}
                  onChange={handleChange}
                  icon={User}
                  placeholder="Name"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Spouse Contact"
                  name="spouseContact"
                  value={formData.spouseContact}
                  onChange={handleChange}
                  icon={Phone}
                  placeholder="Mobile"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Spouse Email"
                  name="spouseEmail"
                  type="email"
                  value={formData.spouseEmail}
                  onChange={handleChange}
                  icon={Mail}
                  placeholder="Email"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Spouse DOB"
                  name="spouseDob"
                  type="date"
                  value={formData.spouseDob}
                  onChange={handleChange}
                  icon={Calendar}
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Anniversary Date"
                  name="anniversaryDate"
                  type="date"
                  value={formData.anniversaryDate}
                  onChange={handleChange}
                  icon={Heart}
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
              </div>
            </Card>
          </section>

          {/* ── Section 3: Site / Project Address ─────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-[var(--accent-teal)] mb-2">
              <div className="p-2 rounded-lg bg-[var(--accent-teal)]/10">
                <MapPin size={24} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-tight">Site / Project Address</h2>
            </div>

            <Card className={`shadow-sm border-l-4 border-l-[var(--accent-teal)] ${!isEditing ? 'bg-[var(--bg)]' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Input
                  label="Project/Building Name"
                  name="projectBuildingName"
                  value={formData.projectBuildingName}
                  onChange={handleChange}
                  placeholder="e.g. Skyline Towers"
                  className={`lg:col-span-2 ${inputCls(!isEditing)}`}
                  disabled={!isEditing}
                />
                <Input
                  label="Tower/Block"
                  name="towerBlock"
                  value={formData.towerBlock}
                  onChange={handleChange}
                  placeholder="e.g. Block A"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Flat/Unit No"
                  name="flatUnit"
                  value={formData.flatUnit}
                  onChange={handleChange}
                  placeholder="e.g. 402"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Floor Number"
                  name="floorNumber"
                  value={formData.floorNumber}
                  onChange={handleChange}
                  placeholder="e.g. 14th"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <div className="lg:col-span-1">
                   <Input
                    label="City"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="e.g. Indore"
                    disabled={!isEditing}
                    className={inputCls(!isEditing)}
                  />
                </div>
                <div className="lg:col-span-2">
                  <FormField label="Complete Site Address">
                    <textarea
                      name="completeSiteAddress"
                      value={formData.completeSiteAddress}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none min-h-[80px] text-sm ${inputCls(!isEditing)}`}
                      placeholder="Detailed site location..."
                    />
                  </FormField>
                </div>
              </div>
            </Card>
          </section>

          {/* ── Section 4: Children ───────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-[var(--text-secondary)] mb-2">
              <div className="p-2 rounded-lg bg-[var(--text-secondary)]/10">
                <Baby size={24} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-tight">Children (if any)</h2>
            </div>

            <Card className={`shadow-sm ${!isEditing ? 'bg-[var(--bg)]' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Input
                  label="Number of Children"
                  name="numChildren"
                  type="number"
                  value={formData.numChildren}
                  onChange={handleChange}
                  icon={Baby}
                  placeholder="e.g. 2"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
                <Input
                  label="Age of Children"
                  name="ageChildren"
                  value={formData.ageChildren}
                  onChange={handleChange}
                  placeholder="e.g. 5 yrs, 8 yrs"
                  disabled={!isEditing}
                  className={inputCls(!isEditing)}
                />
              </div>
            </Card>
          </section>

          {/* ── API Error ─────────────────────────────────────────── */}
          {apiError && (
            <div className="flex items-center gap-2 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl px-4 py-3 text-sm text-[var(--error)] font-medium">
              <AlertCircle size={18} />
              <span>{apiError}</span>
            </div>
          )}

          {/* ── Form Actions ──────────────────────────────────────── */}
          {/* Only render the submit row when the form is editable */}
          {isEditing && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 pb-20 border-t border-[var(--border)]">
              {!isPublic && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => isUpdate ? setIsEditing(false) : window.history.back()}
                  className="text-[var(--text-muted)] hover:text-[var(--error)]"
                >
                  {isUpdate ? 'Cancel Edit' : 'Cancel Onboarding'}
                </Button>
              )}
              {isPublic && <div />}

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {!isPublic && !isUpdate && (
                  <Button variant="outline" type="button" className="sm:px-8">
                    Print Form
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isLoading}
                  className="sm:px-12 shadow-lg shadow-[var(--primary)]/20"
                >
                  {isUpdate ? 'Save Changes' : 'Submit Form Information'}
                </Button>
              </div>
            </div>
          )}

          {/* View mode back button */}
          {!isEditing && isUpdate && !isPublic && (
            <div className="flex justify-start pt-4 pb-20 border-t border-[var(--border)]">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                ← Back to Lead
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default ClientInfoFormPage;
