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
  LayoutGrid,
  Sparkles,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Input from '../../../shared/components/Input/Input';
import Button from '../../../shared/components/Button/Button';
import Select from '../../../shared/components/Select/Select';
import FormField from '../../../shared/components/FormField/FormField';
import useLead from '../hooks/useLead';
import { Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';

const EnquiryFormPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    formData,
    errors,
    isLoading,
    apiError,
    isSuccess,
    handleChange,
    handleSelectChange,
    handleSubmit
  } = useLead();

  const handleFormSubmit = async (e) => {
    await handleSubmit(e);
    if (!apiError) {
      toast.success('Enquiry captured successfully!');
    } else {
      toast.error(apiError);
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
              onClick={() => navigate('/crm/leads/new')}
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--border)] pb-8">
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
        <div className="flex items-center gap-3 bg-[var(--surface)] p-2 rounded-2xl border border-[var(--border)]">
          <div className="px-4 py-2 text-right">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Form ID</p>
            <p className="text-sm font-bold text-[var(--text-primary)] tracking-tighter">ENQ-{Date.now().toString().slice(-6)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
            <LayoutGrid size={20} />
          </div>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-12 pb-24">
        {/* Section 1: Client Personal Info */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
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
              <Input
                label="Contact Number"
                name="contactMobile"
                value={formData.contactMobile}
                onChange={handleChange}
                error={errors.contactMobile}
                icon={Phone}
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
              <Input
                label="Spouse Mobile"
                name="spouseMobile"
                value={formData.spouseMobile}
                onChange={handleChange}
                icon={Phone}
                placeholder="Optional"
              />
            </div>
          </Card>
        </section>

        {/* Section 2: Referral & Context */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Briefcase size={20} />
            </div>
            <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Referral & Source</h2>
          </div>

          <Card className="hover:shadow-md transition-shadow duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Input
                label="Referred By"
                name="referredBy"
                value={formData.referredBy}
                onChange={handleChange}
                icon={Users}
                placeholder="Ex: Architect Name / Instagram"
              />
              <Input
                label="Referrer Phone"
                name="referredMobile"
                value={formData.referredMobile}
                onChange={handleChange}
                icon={Phone}
                placeholder="Optional"
              />
              <Select
                label="Enquiry Type"
                name="enquiryType"
                value={formData.enquiryType}
                onChange={(val) => handleSelectChange('enquiryType', val)}
                options={[
                  { value: 'Residential', label: 'Residential' },
                  { value: 'Commercial', label: 'Commercial' }
                ]}
                icon={Layers}
              />
            </div>
          </Card>
        </section>

        {/* Section 3: Project Requirements */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Project Requirements</h2>
          </div>

          <Card className="hover:shadow-md transition-shadow duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <Input
                label="Enquiry Date"
                name="enquiryDate"
                type="date"
                value={formData.enquiryDate}
                onChange={handleChange}
                icon={Calendar}
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
                placeholder="Ex: 50000"
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

        {/* Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/80 backdrop-blur-md border-t border-[var(--border)] px-8 py-4 flex items-center justify-between z-50">
          <p className="hidden md:block text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
            Ensure all required fields (*) are filled
          </p>
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
        </div>
      </form>

      {isLoading && <Loader fullPage label="Registering opportunity..." />}
    </div>
  );
};

export default EnquiryFormPage;
