import { useState } from 'react';
import { crmService } from '../services/crmService';

const initialState = {
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
  notes: '',
};

const validateForm = (data) => {
  const errors = {};

  if (!data.clientName.trim()) errors.clientName = 'Client name is required';
  if (!data.contactMobile.trim()) {
    errors.contactMobile = 'Mobile number is required';
  } else if (!/^\d{10}$/.test(data.contactMobile.replace(/\D/g, ''))) {
    errors.contactMobile = 'Enter a valid 10-digit mobile number';
  }

  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Enter a valid email address';
  }

  return errors;
};

export const useEnquiry = ({ onSuccess } = {}) => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submitEnquiry = async () => {
    setApiError('');
    const validationErrors = validateForm(formData);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return null;
    }

    setIsLoading(true);
    try {
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
        area: Number(formData.approxArea || 0),
        budget: Number(formData.quotedAmount || 0),
        city: formData.city,
        siteAddress: formData.siteDetails,
        notes: formData.notes,
      };

      const response = await crmService.createLead(payload);
      const lead = response.lead;

      if (lead && onSuccess) {
        onSuccess(lead, formData);
      }

      setFormData(initialState);
      return lead;
    } catch (error) {
      setApiError(error || 'Failed to submit enquiry. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    errors,
    isLoading,
    apiError,
    handleChange,
    handleSelectChange,
    submitEnquiry,
  };
};

export default useEnquiry;
