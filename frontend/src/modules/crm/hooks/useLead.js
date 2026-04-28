import { useState, useEffect } from 'react';
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
  enquiryDate: new Date().toISOString().split('T')[0],
  siteDetails: '',
  city: '',
  quotedAmount: '',
  finalFees: '',
  approxArea: '',
  notes: ''
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

const useLead = () => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
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
    setIsSuccess(false);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: formData.clientName,
        phone: formData.contactMobile,
        email: formData.email,
        spouse: {
          name: formData.spouseName,
          phone: formData.spouseMobile
        },
        referredBy: formData.referredBy,
        referrerPhone: formData.referredMobile,
        projectType: formData.enquiryType,
        area: formData.approxArea,
        budget: formData.quotedAmount,
        city: formData.city,
        siteAddress: formData.siteDetails,
        notes: formData.notes
      };

      const response = await crmService.createLead(payload);
      
      // Track lead in context for flow continuity
      if (response && response._id) {
        setActiveLead({
          id: response._id,
          name: formData.clientName,
          email: formData.email,
          phone: formData.contactMobile
        });
      }

      setIsSuccess(true);
      setFormData(initialState);
    } catch (err) {
      setApiError(err || 'Failed to submit enquiry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    errors,
    isLoading,
    apiError,
    isSuccess,
    handleChange,
    handleSelectChange,
    handleSubmit
  };
};

export default useLead;
