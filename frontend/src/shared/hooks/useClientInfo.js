import { useEffect, useState, useCallback } from 'react';
import { crmService } from '../services/crmService';

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
  city: '',
  numChildren: '',
  ageChildren: '',
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

/**
 * Maps a Client API response object → flat form state.
 */
const clientToFormData = (client) => ({
  date: client.createdAt
    ? new Date(client.createdAt).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0],
  name: client.name || '',
  contactNumber: client.phone || '',
  email: client.email || '',
  residentialAddress: client.address || '',
  companyName: client.companyName || '',
  officeAddress: client.officeAddress || '',
  dob: client.dob ? new Date(client.dob).toISOString().split('T')[0] : '',
  spouseName: client.spouse?.name || '',
  spouseContact: client.spouse?.phone || '',
  spouseEmail: client.spouse?.email || '',
  spouseDob: client.spouse?.dob
    ? new Date(client.spouse.dob).toISOString().split('T')[0]
    : '',
  anniversaryDate: client.spouse?.anniversary
    ? new Date(client.spouse.anniversary).toISOString().split('T')[0]
    : '',
  projectBuildingName: client.siteAddress?.buildingName || '',
  towerBlock: client.siteAddress?.tower || '',
  flatUnit: client.siteAddress?.unit || '',
  floorNumber: client.siteAddress?.floor || '',
  completeSiteAddress: client.siteAddress?.fullAddress || '',
  city: client.siteAddress?.city || '',
  numChildren: client.children?.length ? String(client.children.length) : '',
  ageChildren: client.children?.length
    ? client.children.map((c) => c.age).filter(Boolean).join(', ')
    : '',
});

/**
 * useClientInfo
 *
 * @param {object} options
 * @param {object}  options.activeLead  – { id, _id, name, phone, email } from CRM context / location state
 * @param {string}  options.clientId    – existing Client._id if the lead already has one
 * @param {function} options.onSuccess  – callback(client, formData) after successful save
 */
export const useClientInfo = ({ activeLead, clientId, onSuccess } = {}) => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  // Track which client record to UPDATE (null = must CREATE)
  const [existingClientId, setExistingClientId] = useState(clientId || null);

  /**
   * Fetch existing client and populate the entire form.
   */
  const fetchExistingClient = useCallback(async (cid) => {
    if (!cid) return;
    setIsFetching(true);
    try {
      const response = await crmService.getClientById(cid);
      if (response?.client) {
        setFormData(clientToFormData(response.client));
        setExistingClientId(cid);
      }
    } catch {
      // silently ignore – form stays at initial/lead-prefill state
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Destructure to primitives — avoids passing the object itself as a dep
  // (object refs change every render, causing an infinite re-render loop)
  const _leadId    = activeLead?._id || activeLead?.id;
  const _leadName  = activeLead?.name;
  const _leadPhone = activeLead?.phone;
  const _leadEmail = activeLead?.email;

  useEffect(() => {
    if (clientId) {
      // Existing client → fetch full data
      fetchExistingClient(clientId);
    } else if (_leadId) {
      // No client yet → pre-fill info from the lead enquiry
      setFormData((prev) => ({
        ...prev,
        name:                _leadName               || '',
        contactNumber:       _leadPhone              || '',
        email:               _leadEmail              || '',
        spouseName:          activeLead?.spouse?.name || '',
        spouseContact:       activeLead?.spouse?.phone || '',
        city:                activeLead?.city        || '',
        completeSiteAddress: activeLead?.siteAddress || '',
      }));
    } else {
      // Context cleared → reset to fresh form
      setFormData(initialState);
      setExistingClientId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, _leadId, _leadName, _leadPhone, _leadEmail, fetchExistingClient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const submitClientInfo = async () => {
    setApiError('');
    setIsSuccess(false);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return null;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.contactNumber,
        email: formData.email,
        address: formData.residentialAddress,
        dob: formData.dob || undefined,
        companyName: formData.companyName,
        officeAddress: formData.officeAddress,
        spouse: {
          name: formData.spouseName,
          phone: formData.spouseContact,
          email: formData.spouseEmail,
          dob: formData.spouseDob || undefined,
          anniversary: formData.anniversaryDate || undefined,
        },
        children: formData.numChildren
          ? Array.from({ length: Number(formData.numChildren) || 0 }, () => ({
              age: Number(formData.ageChildren || 0),
            }))
          : [],
        siteAddress: {
          buildingName: formData.projectBuildingName,
          tower: formData.towerBlock,
          unit: formData.flatUnit,
          floor: formData.floorNumber,
          fullAddress: formData.completeSiteAddress,
          city: formData.city,
        },
        leadId: activeLead?._id || activeLead?.id,
      };

      let response;
      if (existingClientId) {
        // ── UPDATE existing client ──────────────────────────────────
        response = await crmService.updateClient(existingClientId, payload);
      } else {
        // ── CREATE new client ───────────────────────────────────────
        response = await crmService.createClient(payload);
        if (response?.client?._id) {
          setExistingClientId(response.client._id);
        }
      }

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(response.client, formData);
      }
      return response.client;
    } catch (error) {
      setApiError(error || 'Failed to submit client information. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    errors,
    isLoading,
    isFetching,
    apiError,
    isSuccess,
    isUpdate: !!existingClientId,
    handleChange,
    submitClientInfo,
  };
};

export default useClientInfo;
