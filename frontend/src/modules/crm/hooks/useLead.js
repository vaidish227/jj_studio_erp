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
  referredEmail: '',
  enquiryType: 'Residential',
  source: 'walk_in',
  enquiryDate: new Date().toISOString().split('T')[0],
  preferredMeetingDate: '',
  preferredMeetingTime: '',
  // When true, a real Meeting is created right after the enquiry is saved.
  scheduleMeetingNow: false,
  meetingType: 'office', // 'office' | 'site' | 'call'
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

// Combine a 'YYYY-MM-DD' date and 'HH:mm' time into a local Date (no UTC drift).
const combineDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
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
  if (!String(data.city || '').trim()) errors.city = 'City / Location is required';
  if (!String(data.approxArea || '').trim()) {
    errors.approxArea = 'Approx area is required';
  } else if (!(Number(data.approxArea) > 0)) {
    errors.approxArea = 'Enter a valid area';
  }
  if (!String(data.quotedAmount || '').trim()) {
    errors.quotedAmount = 'Fees estimate is required';
  } else if (!(Number(data.quotedAmount) > 0)) {
    errors.quotedAmount = 'Enter a valid fees estimate';
  }
  if (!String(data.siteDetails || '').trim()) errors.siteDetails = 'Site details / address is required';
  // Scheduling a meeting on submit needs a concrete, future date + time.
  if (data.scheduleMeetingNow) {
    if (!data.preferredMeetingDate) {
      errors.preferredMeetingDate = 'Pick a date to schedule the meeting';
    }
    if (!data.preferredMeetingTime) {
      errors.preferredMeetingTime = 'Pick a time to schedule the meeting';
    }
    if (data.preferredMeetingDate && data.preferredMeetingTime) {
      const when = combineDateTime(data.preferredMeetingDate, data.preferredMeetingTime);
      if (when && when.getTime() <= Date.now()) {
        errors.preferredMeetingTime = 'Meeting date and time must be in the future';
      }
    }
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
        referrerEmail: formData.referredEmail,
        projectType: formData.enquiryType,
        source: formData.source || (formData.referredBy ? 'referral' : 'walk_in'),
        area: formData.approxArea ? Number(formData.approxArea) : undefined,
        budget: formData.quotedAmount ? Number(formData.quotedAmount) : undefined,
        city: formData.city,
        siteAddress: formData.siteDetails,
        notes: formData.notes,
        preferredMeetingDate: formData.preferredMeetingDate || undefined,
        preferredMeetingTime: formData.preferredMeetingTime || undefined,
      };

      // Calls POST /api/clients/create → CRMClient.controller.createClientEnquiry
      const response = await crmService.createLead(payload);

      // Response returns { client, lead } — use either
      const newClient = response.client || response.lead;
      const newClientId = newClient && (newClient._id || newClient.id);
      if (newClientId) {
        setActiveLead({
          id: newClientId,
          _id: newClientId,
          name: newClient.name,
          email: newClient.email,
          phone: newClient.phone,
          trackingId: newClient.trackingId,
        });
      }

      // Optionally schedule a real meeting right away. The lead already exists,
      // so a scheduling failure (slot taken, no permission, etc.) must NOT lose
      // the enquiry — we surface it as a warning instead of failing the submit.
      let meetingWarning = null;
      let meetingScheduled = false;
      if (formData.scheduleMeetingNow && newClientId) {
        const when = combineDateTime(formData.preferredMeetingDate, formData.preferredMeetingTime);
        try {
          await crmService.createMeeting({
            leadId: newClientId,
            date: when.toISOString(),
            type: formData.meetingType || 'office',
            attendees: {
              internal: [],
              client: [{
                name: formData.clientName,
                email: formData.email,
                phone: formData.contactMobile,
                relation: 'lead',
                notifyEmail: true,
                notifyWhatsApp: true,
              }],
            },
          });
          meetingScheduled = true;
        } catch (meetingErr) {
          meetingWarning = meetingErr?.message
            || 'Enquiry saved, but the meeting could not be scheduled. You can schedule it from the lead page.';
        }
      }

      setIsSuccess(true);
      setFormData(initialState);
      return { success: true, meetingScheduled, meetingWarning };
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
