import { useState } from 'react';
import { crmService } from '../../../shared/services/crmService';
import { useCRM } from '../context/CRMContext';

const initialState = {
  clientName: '',
  contactMobile: '',
  email: '',
  spouseName: '',
  spouseMobile: '',
  referredBy: '',
  referredMobile: '',
  enquiryType: 'Residential',
  source: 'walk_in',
  enquiryDate: new Date().toISOString().split('T')[0],
  preferredMeetingDate: '',
  siteDetails: '',
  city: '',
  quotedAmount: '',
  finalFees: '',
  approxArea: '',
  notes: ''
};

// PhoneInput emits the full E.164 form ("+919876543210"), so strip the leading
// "91" country code before checking for 10 local digits — but only when it's
// clearly a prefix (>10 digits), not when a valid 10-digit number starts with 91.
const localMobileDigits = (raw) => {
  let s = String(raw || '').replace(/\D/g, '');
  if (s.length > 10 && s.startsWith('91')) s = s.slice(2);
  return s;
};

const validateForm = (data) => {
  const errors = {};
  if (!data.clientName.trim()) errors.clientName = 'Client name is required';
  if (!data.contactMobile.trim()) {
    errors.contactMobile = 'Mobile number is required';
  } else if (!/^\d{10}$/.test(localMobileDigits(data.contactMobile))) {
    errors.contactMobile = 'Enter a valid 10-digit mobile number';
  }
  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Enter a valid email address';
  }
  return errors;
};

const useLead = () => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [existingClient, setExistingClient] = useState(null);
  const { setActiveLead } = useCRM();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setExistingClient(null);
    setIsSuccess(false);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return { success: false };
    }

    setIsLoading(true);
    try {
      // Map frontend field names to unified CRMClient schema
      const payload = {
        name: formData.clientName,
        phone: formData.contactMobile,
        email: formData.email,
        spouse: {
          name: formData.spouseName,
          phone: formData.spouseMobile,
        },
        referredBy: formData.referredBy,
        referrerPhone: formData.referredMobile,
        projectType: formData.enquiryType,
        source: formData.source || (formData.referredBy ? 'referral' : 'walk_in'),
        area: formData.approxArea ? Number(formData.approxArea) : undefined,
        budget: formData.quotedAmount ? Number(formData.quotedAmount) : undefined,
        city: formData.city,
        siteAddress: formData.siteDetails,
        notes: formData.notes,
        preferredMeetingDate: formData.preferredMeetingDate || undefined,
      };

      // Calls POST /api/clients/create → CRMClient.controller.createClientEnquiry
      const response = await crmService.createLead(payload);
      
      // Response returns { client, lead } — use either
      const newClient = response.client || response.lead;
      if (newClient && (newClient._id || newClient.id)) {
        setActiveLead({
          id: newClient._id || newClient.id,
          _id: newClient._id || newClient.id,
          name: newClient.name,
          email: newClient.email,
          phone: newClient.phone,
          trackingId: newClient.trackingId,
        });
      }

      setIsSuccess(true);
      setFormData(initialState);
      return { success: true };
    } catch (err) {
      const message = err?.message || 'Failed to submit enquiry. Please try again.';
      setApiError(message);
      if (err?.existingId) {
        setExistingClient({ id: err.existingId, trackingId: err.trackingId });
      }
      return { success: false, existingId: err?.existingId, trackingId: err?.trackingId, message };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    errors,
    isLoading,
    apiError,
    existingClient,
    isSuccess,
    handleChange,
    handleSelectChange,
    handleSubmit
  };
};

export default useLead;
