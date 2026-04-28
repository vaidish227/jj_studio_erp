import { useState, useEffect } from 'react';
import { crmService } from '../../../shared/services/crmService';
import { useCRM } from '../context/CRMContext';

const initialState = {
  date: new Date().toISOString().split('T')[0],
  name: '',
  contactNumber: '',
  email: '',
  residentialAddress: '',
  companyName: '',
  officeAddress: '',
  dob: '',
  spouseName: '',
  spouseContact: '',
  spouseEmail: '',
  spouseDob: '',
  anniversaryDate: '',
  projectBuildingName: '',
  towerBlock: '',
  flatUnit: '',
  floorNumber: '',
  completeSiteAddress: '',
  numChildren: '',
  ageChildren: ''
};

const validateForm = (data) => {
  const errors = {};
  if (!data.name.trim()) errors.name = 'Client name is required';
  if (!data.contactNumber.trim()) {
    errors.contactNumber = 'Contact number is required';
  } else if (!/^\d{10}$/.test(data.contactNumber.replace(/\D/g, ''))) {
    errors.contactNumber = 'Enter a valid 10-digit number';
  }
  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Enter a valid email address';
  }
  return errors;
};

const useClient = () => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const { activeLead, clearActiveLead } = useCRM();

  // Pre-fill from lead if available
  useEffect(() => {
    if (activeLead) {
      setFormData(prev => ({
        ...prev,
        name: activeLead.name,
        contactNumber: activeLead.phone,
        email: activeLead.email
      }));
    }
  }, [activeLead]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
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
      // Map frontend state to backend model (Client.model.js)
      const payload = {
        name: formData.name,
        phone: formData.contactNumber,
        email: formData.email,
        address: formData.residentialAddress,
        dob: formData.dob,
        companyName: formData.companyName,
        officeAddress: formData.officeAddress,
        spouse: {
          name: formData.spouseName,
          phone: formData.spouseContact,
          email: formData.spouseEmail,
          dob: formData.spouseDob,
          anniversary: formData.anniversaryDate
        },
        siteAddress: {
          buildingName: formData.projectBuildingName,
          tower: formData.towerBlock,
          unit: formData.flatUnit,
          floor: formData.floorNumber,
          fullAddress: formData.completeSiteAddress
        },
        leadId: activeLead?.id // Link to lead if coming from flow
      };

      await crmService.createClient(payload);
      setIsSuccess(true);
      clearActiveLead(); // Flow complete
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setApiError(err || 'Failed to submit client information. Please try again.');
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
    handleSubmit,
    activeLead
  };
};

export default useClient;
