import React, { useState } from 'react';
import { User, Phone, Mail, MapPin, Calendar, IndianRupee, FileText, Share2 } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import FormField from '../../../shared/components/FormField/FormField';
import Input from '../../../shared/components/Input/Input';
import Select from '../../../shared/components/Select/Select';
import Button from '../../../shared/components/Button/Button';

const EnquiryFormPage = () => {
  const [formData, setFormData] = useState({
    clientName: '',
    contactMobile: '',
    email: '',
    spouseName: '',
    spouseMobile: '',
    referredBy: '',
    referredMobile: '',
    enquiryType: 'Residential',
    enquiryDate: new Date().toISOString().split('T')[0],
    siteDetails: '',
    city: '',
    quotedAmount: '',
    finalFees: '',
    approxArea: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.clientName.trim()) newErrors.clientName = 'Client name is required';
    if (!formData.contactMobile.trim()) {
      newErrors.contactMobile = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(formData.contactMobile.replace(/\D/g, ''))) {
      newErrors.contactMobile = 'Enter a valid 10-digit mobile number';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      console.log('Form Submitted:', formData);
      alert('Enquiry saved successfully!');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4 px-4">
      <div className="flex flex-col gap-2 border-l-4 border-[var(--primary)] pl-4">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">New Enquiry</h1>
        <p className="text-[var(--text-secondary)] text-lg font-medium">Capture comprehensive details for potential leads.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Client & Personal Details */}
        <Card className="overflow-hidden border-t-4 border-t-[var(--primary)] shadow-md">
          <div className="flex items-center gap-2 mb-6 text-[var(--primary)] font-bold text-lg uppercase tracking-wider">
            <User size={20} />
            <span>Client & Personal Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Input 
              label="Name of Client" 
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              error={errors.clientName}
              icon={User}
              placeholder="Full Name"
              required
            />
            <Input 
              label="Contact Mobile No" 
              name="contactMobile"
              value={formData.contactMobile}
              onChange={handleChange}
              error={errors.contactMobile}
              icon={Phone}
              placeholder="10-digit number"
              required
            />
            <Input 
              label="Email ID" 
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
              icon={User}
              placeholder="Spouse/Partner Name"
            />
            <Input 
              label="Spouse Mobile No" 
              name="spouseMobile"
              value={formData.spouseMobile}
              onChange={handleChange}
              icon={Phone}
              placeholder="Spouse Contact"
            />
          </div>
        </Card>

        {/* Section 2: Referral & Context */}
        <Card className="shadow-md border-l-4 border-l-[var(--accent-blue)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Referral Sub-section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[var(--accent-blue)] font-bold text-sm uppercase tracking-wider pb-2 border-b border-[var(--border)]">
                <Share2 size={16} />
                <span>Referral Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input 
                  label="Referred by" 
                  name="referredBy"
                  value={formData.referredBy}
                  onChange={handleChange}
                  placeholder="Name / Source"
                />
                <Input 
                  label="Referrer Mobile" 
                  name="referredMobile"
                  value={formData.referredMobile}
                  onChange={handleChange}
                  placeholder="Mobile number"
                />
              </div>
            </div>

            {/* Enquiry Context Sub-section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[var(--accent-blue)] font-bold text-sm uppercase tracking-wider pb-2 border-b border-[var(--border)]">
                <FileText size={16} />
                <span>Enquiry Type & Date</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select 
                  label="Enquiry Type"
                  value={formData.enquiryType}
                  onChange={(val) => handleSelectChange('enquiryType', val)}
                  options={[
                    { value: 'Residential', label: 'Residential' },
                    { value: 'Commercial', label: 'Commercial' },
                  ]}
                />
                <Input 
                  label="1st Enquiry Date" 
                  name="enquiryDate"
                  type="date"
                  value={formData.enquiryDate}
                  onChange={handleChange}
                  icon={Calendar}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Section 3: Site Details */}
        <Card className="shadow-md border-l-4 border-l-[var(--accent-teal)]">
          <div className="flex items-center gap-2 mb-6 text-[var(--accent-teal)] font-bold text-lg uppercase tracking-wider">
            <MapPin size={20} />
            <span>Site & Project Scope</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Input 
                label="City" 
                name="city"
                value={formData.city}
                onChange={handleChange}
                icon={MapPin}
                placeholder="Project City"
              />
              <FormField label="Site Details (if available)">
                <textarea 
                  name="siteDetails"
                  value={formData.siteDetails}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none min-h-[100px] text-sm text-[var(--text-primary)]"
                  placeholder="Address or layout details..."
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
              <Input 
                label="Approx Area (sqft)" 
                name="approxArea"
                value={formData.approxArea}
                onChange={handleChange}
                placeholder="e.g. 1200"
              />
              <Input 
                label="Amount Quoted" 
                name="quotedAmount"
                value={formData.quotedAmount}
                onChange={handleChange}
                icon={IndianRupee}
                placeholder="Initial Quote"
              />
              <Input 
                label="Final Fees Agreement" 
                name="finalFees"
                value={formData.finalFees}
                onChange={handleChange}
                icon={FileText}
                placeholder="Agreed amount"
                className="sm:col-span-2"
              />
            </div>
          </div>
        </Card>

        {/* Section 4: Notes */}
        <Card className="shadow-md">
          <div className="flex items-center gap-2 mb-4 text-[var(--text-secondary)] font-bold text-lg uppercase tracking-wider">
            <FileText size={20} />
            <span>Additional Notes</span>
          </div>
          <textarea 
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none min-h-[120px] text-sm text-[var(--text-primary)]"
            placeholder="Any other specific client requirements or constraints..."
          />
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 pb-10 border-t border-[var(--border)]">
          <Button variant="ghost" type="button" onClick={() => window.history.back()} className="text-[var(--text-muted)] hover:text-[var(--error)]">
            Discard Enquiry
          </Button>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button variant="outline" type="button" className="sm:px-8">
              Save as Draft
            </Button>
            <Button type="submit" variant="primary" className="sm:px-12 shadow-lg shadow-[var(--primary)]/20">
              Submit Enquiry
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EnquiryFormPage;
