import React, { useState } from 'react';
import { User, Phone, Mail, Home, Briefcase, Calendar, MapPin, Baby, Heart } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import FormField from '../../../shared/components/FormField/FormField';
import Input from '../../../shared/components/Input/Input';
import Button from '../../../shared/components/Button/Button';

const ClientInfoFormPage = ({ isPublic = false }) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    // Primary Client
    name: '',
    contactNumber: '',
    email: '',
    residentialAddress: '',
    companyName: '',
    officeAddress: '',
    dob: '',
    // Spouse
    spouseName: '',
    spouseContact: '',
    spouseEmail: '',
    spouseDob: '',
    anniversaryDate: '',
    // Site
    projectBuildingName: '',
    towerBlock: '',
    flatUnit: '',
    floorNumber: '',
    completeSiteAddress: '',
    // Children
    numChildren: '',
    ageChildren: ''
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Client name is required';
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else if (!/^\d{10}$/.test(formData.contactNumber.replace(/\D/g, ''))) {
      newErrors.contactNumber = 'Enter a valid 10-digit number';
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
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      console.log('Client Info Form Submitted:', formData);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4">
        <Card className="text-center py-16 space-y-6 shadow-2xl border-t-4 border-t-[var(--success)]">
          <div className="w-20 h-20 bg-[var(--success)]/10 text-[var(--success)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Thank You!</h1>
          <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto">
            Your information has been successfully submitted. The JJ Studio team will review the details and get in touch with you shortly.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={`mx-auto space-y-8 py-4 px-4 ${isPublic ? 'max-w-5xl' : 'max-w-6xl'}`}>
      {!isPublic && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Client Information Form</h1>
            <p className="text-[var(--text-secondary)] font-medium">Complete profile for project onboarding.</p>
          </div>
          <div className="w-full md:w-auto">
            <Input 
              label="Form Date" 
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              icon={Calendar}
              className="md:w-64"
            />
          </div>
        </div>
      )}

      {isPublic && (
        <div className="text-center space-y-2 mb-10">
          <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight">Onboarding Details</h1>
          <p className="text-[var(--text-secondary)] text-lg">Please fill out the form below to help us understand your requirements better.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Section 1: Primary Client */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-[var(--primary)] mb-2">
            <div className="p-2 rounded-lg bg-[var(--primary)]/10">
              <User size={24} />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Primary Client Details</h2>
          </div>
          
          <Card className="shadow-sm hover:shadow-md transition-shadow">
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
              />
              <Input 
                label="Date of Birth" 
                name="dob"
                type="date"
                value={formData.dob}
                onChange={handleChange}
                icon={Calendar}
              />
              <Input 
                label="Company Name" 
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                icon={Briefcase}
                placeholder="Optional"
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
                    className="w-full pl-12 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none min-h-[80px] text-sm"
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
                    className="w-full pl-12 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none min-h-[80px] text-sm"
                    placeholder="Complete office address..."
                  />
                </div>
              </FormField>
            </div>
          </Card>
        </section>

        {/* Section 2: Spouse/Partner */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-[var(--accent-blue)] mb-2">
            <div className="p-2 rounded-lg bg-[var(--accent-blue)]/10">
              <Heart size={24} />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Spouse/Partner Details</h2>
          </div>
          
          <Card className="shadow-sm border-l-4 border-l-[var(--accent-blue)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Input 
                label="Spouse/Partner Name" 
                name="spouseName"
                value={formData.spouseName}
                onChange={handleChange}
                icon={User}
                placeholder="Name"
              />
              <Input 
                label="Spouse Contact" 
                name="spouseContact"
                value={formData.spouseContact}
                onChange={handleChange}
                icon={Phone}
                placeholder="Mobile"
              />
              <Input 
                label="Spouse Email" 
                name="spouseEmail"
                type="email"
                value={formData.spouseEmail}
                onChange={handleChange}
                icon={Mail}
                placeholder="Email"
              />
              <Input 
                label="Spouse DOB" 
                name="spouseDob"
                type="date"
                value={formData.spouseDob}
                onChange={handleChange}
                icon={Calendar}
              />
              <Input 
                label="Anniversary Date" 
                name="anniversaryDate"
                type="date"
                value={formData.anniversaryDate}
                onChange={handleChange}
                icon={Heart}
              />
            </div>
          </Card>
        </section>

        {/* Section 3: Site / Project Address */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-[var(--accent-teal)] mb-2">
            <div className="p-2 rounded-lg bg-[var(--accent-teal)]/10">
              <MapPin size={24} />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Site / Project Address</h2>
          </div>
          
          <Card className="shadow-sm border-l-4 border-l-[var(--accent-teal)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Input 
                label="Project/Building Name" 
                name="projectBuildingName"
                value={formData.projectBuildingName}
                onChange={handleChange}
                placeholder="e.g. Skyline Towers"
                className="lg:col-span-2"
              />
              <Input 
                label="Tower/Block" 
                name="towerBlock"
                value={formData.towerBlock}
                onChange={handleChange}
                placeholder="e.g. Block A"
              />
              <Input 
                label="Flat/Unit No" 
                name="flatUnit"
                value={formData.flatUnit}
                onChange={handleChange}
                placeholder="e.g. 402"
              />
              <Input 
                label="Floor Number" 
                name="floorNumber"
                value={formData.floorNumber}
                onChange={handleChange}
                placeholder="e.g. 14th"
              />
              <div className="lg:col-span-3">
                <FormField label="Complete Site Address">
                  <textarea 
                    name="completeSiteAddress"
                    value={formData.completeSiteAddress}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none min-h-[80px] text-sm"
                    placeholder="Detailed site location..."
                  />
                </FormField>
              </div>
            </div>
          </Card>
        </section>

        {/* Section 4: Children */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-[var(--text-secondary)] mb-2">
            <div className="p-2 rounded-lg bg-[var(--text-secondary)]/10">
              <Baby size={24} />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Children (if any)</h2>
          </div>
          
          <Card className="shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Input 
                label="Number of Children" 
                name="numChildren"
                type="number"
                value={formData.numChildren}
                onChange={handleChange}
                icon={Baby}
                placeholder="e.g. 2"
              />
              <Input 
                label="Age of Children" 
                name="ageChildren"
                value={formData.ageChildren}
                onChange={handleChange}
                placeholder="e.g. 5 yrs, 8 yrs"
              />
            </div>
          </Card>
        </section>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 pb-20 border-t border-[var(--border)]">
          {!isPublic && (
            <Button variant="ghost" type="button" onClick={() => window.history.back()} className="text-[var(--text-muted)] hover:text-[var(--error)]">
              Cancel Onboarding
            </Button>
          )}
          {isPublic && <div />} {/* Spacer */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {!isPublic && (
              <Button variant="outline" type="button" className="sm:px-8">
                Print Form
              </Button>
            )}
            <Button type="submit" variant="primary" className="sm:px-12 shadow-lg shadow-[var(--primary)]/20">
              Submit Form Information
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ClientInfoFormPage;
