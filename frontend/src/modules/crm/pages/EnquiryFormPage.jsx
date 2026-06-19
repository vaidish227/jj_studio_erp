import React from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  IndianRupee,
  Briefcase,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Input from '../../../shared/components/Input/Input';
import DatePicker from '../../../shared/components/DatePicker/DatePicker';
import { PhoneInput } from '../../../shared/components';
import Button from '../../../shared/components/Button/Button';
import Select from '../../../shared/components/Select/Select';
import FormField from '../../../shared/components/FormField/FormField';
import useLead from '../hooks/useLead';
import { Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import usePermission from '../../../shared/hooks/usePermission';

const EnquiryFormPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  // Creating an enquiry is a CRM create action. Read-only roles can still open
  // and view the form, but the submit is replaced with a permission notice.
  const canCreate = usePermission('crm.create');
  const {
    formData,
    errors,
    isLoading,
    apiError,
    existingClient,
    isSuccess,
    handleChange,
    handleSelectChange,
    handleSubmit
  } = useLead();

  const handleFormSubmit = async (e) => {
    const result = await handleSubmit(e);
    if (result?.success) {
      toast.success('Enquiry captured successfully!');
    } else if (result && !result.existingId && result.message) {
      toast.error(result.message);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 animate-in zoom-in duration-500">
        <Card className="text-center py-20 space-y-8 border-t-8 border-t-[var(--primary)] shadow-2xl">
          <div className="w-24 h-24 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full flex items-center justify-center mx-auto ring-8 ring-[var(--primary)]/5">
            <CheckCircle2 size={48} className="animate-bounce" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight">Enquiry Captured!</h1>
            <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto font-medium">
              The new lead has been successfully registered in the system.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => navigate('/crm/new-leads')}
              className="px-8"
            >
              View All Leads
            </Button>
            <Button 
              variant="primary" 
              onClick={() => navigate('/crm/forms/client-info')}
              className="px-8 shadow-lg shadow-[var(--primary)]/20"
            >
              Onboard Client Details <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-6 px-4 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="border-b border-[var(--border)] pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[var(--primary)] mb-1">
            <Sparkles size={20} className="animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">New Opportunity</span>
          </div>
          <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight">Create New Enquiry</h1>
          <p className="text-[var(--text-secondary)] font-medium max-w-xl">
            Register a new prospective client and their initial project requirements.
          </p>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-12">
        {/* Section 1: Client Personal Info */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <User size={20} />
            </div>
            <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Personal Information</h2>
          </div>
          
          <Card className="hover:shadow-md transition-shadow duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Input
                label="Full Name / Client Name"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                error={errors.clientName}
                icon={User}
                placeholder="Ex: Rajesh Kumar"
                required
              />
              <PhoneInput
                label="Contact Number"
                name="contactMobile"
                value={formData.contactMobile}
                onChange={handleChange}
                error={errors.contactMobile}
                placeholder="10-digit mobile"
                required
              />
              <Input
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                icon={Mail}
                placeholder="client@example.com"
                required
              />
              <Input
                label="Spouse Name"
                name="spouseName"
                value={formData.spouseName}
                onChange={handleChange}
                icon={Users}
                placeholder="Optional"
              />
              <PhoneInput
                label="Spouse Mobile"
                name="spouseMobile"
                value={formData.spouseMobile}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
          </Card>
        </section>

        {/* Section 2: Referral & Context */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center">
              <Briefcase size={20} />
            </div>
            <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Referral & Source</h2>
          </div>

          <Card className="hover:shadow-md transition-shadow duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Select
                label="Lead Source"
                name="source"
                value={formData.source}
                onChange={(val) => handleSelectChange('source', val)}
                options={[
                  { value: 'walk_in', label: 'Walk-In' },
                  { value: 'referral', label: 'Referral' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'website', label: 'Website' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'other', label: 'Other' },
                ]}
                icon={Layers}
              />
              <Input
                label="Referred By"
                name="referredBy"
                value={formData.referredBy}
                onChange={handleChange}
                icon={Users}
                placeholder="Name / Instagram handle"
              />
              <PhoneInput
                label="Referrer Phone"
                name="referredMobile"
                value={formData.referredMobile}
                onChange={handleChange}
                placeholder="Optional"
              />
              <Input
                label="Referral Email"
                name="referredEmail"
                type="email"
                value={formData.referredEmail}
                onChange={handleChange}
                icon={Mail}
                placeholder="Optional"
              />
              <Select
                label="Project Type"
                name="enquiryType"
                value={formData.enquiryType}
                onChange={(val) => handleSelectChange('enquiryType', val)}
                options={[
                  { value: 'Residential', label: 'Residential' },
                  { value: 'Commercial', label: 'Commercial' },
                ]}
                icon={Layers}
              />
            </div>
          </Card>
        </section>

        {/* Section 3: Project Requirements */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Project Requirements</h2>
          </div>

          <Card className="hover:shadow-md transition-shadow duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <DatePicker
                label="Enquiry Date"
                name="enquiryDate"
                value={formData.enquiryDate}
                onChange={handleChange}
                icon={Calendar}
                yearRange={{ from: 2020, to: new Date().getFullYear() + 1 }}
              />
              <DatePicker
                label="Preferred Meeting Date"
                name="preferredMeetingDate"
                value={formData.preferredMeetingDate}
                onChange={handleChange}
                icon={Calendar}
                yearRange={{ from: new Date().getFullYear(), to: new Date().getFullYear() + 2 }}
              />
              <Input
                label="City / Location"
                name="city"
                value={formData.city}
                onChange={handleChange}
                icon={MapPin}
                placeholder="Ex: Indore"
              />
              <Input
                label="Approx Area (Sq.Ft)"
                name="approxArea"
                type="number"
                value={formData.approxArea}
                onChange={handleChange}
                icon={Layers}
                placeholder="Ex: 2500"
              />
              <Input
                label="Fees Estimate (₹)"
                name="quotedAmount"
                type="number"
                value={formData.quotedAmount}
                onChange={handleChange}
                icon={IndianRupee}
                placeholder="Ex: 1500000"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <FormField label="Site Details / Address">
                <textarea
                  name="siteDetails"
                  value={formData.siteDetails}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] transition-all font-medium text-sm min-h-[100px]"
                  placeholder="Detailed address or location specifics..."
                />
              </FormField>
              <FormField label="Additional Notes">
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] transition-all font-medium text-sm min-h-[100px]"
                  placeholder="Any other specific requirements or client requests..."
                />
              </FormField>
            </div>
          </Card>
        </section>

        {/* Existing client conflict banner */}
        {existingClient && (
          <div className="flex items-start gap-4 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/8 px-5 py-4">
            <AlertCircle size={20} className="text-[var(--warning)] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)]">Client already exists in the system</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                A record with this phone or email already exists ({existingClient.trackingId}).
                You cannot create a duplicate — use the existing client record to send a proposal.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(`/crm/new-leads`)}
                className="whitespace-nowrap"
              >
                Open CRM
              </Button>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="border-t border-[var(--border)] pt-6 flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
            Ensure all required fields (*) are filled
          </p>
          {canCreate ? (
            <div className="flex items-center gap-4 w-full md:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1 md:flex-none px-8"
              >
                Discard
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="flex-1 md:flex-none px-12 shadow-lg shadow-[var(--primary)]/20"
              >
                Register Enquiry
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                <AlertCircle size={16} className="text-[var(--text-muted)] shrink-0" />
                <span>You don't have permission to create enquiries. This form is view-only.</span>
              </div>
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="px-8">
                Back
              </Button>
            </div>
          )}
        </div>
      </form>

      {isLoading && <Loader fullPage label="Registering opportunity..." />}
    </div>
  );
};

export default EnquiryFormPage;
