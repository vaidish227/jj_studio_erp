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
 * Maps a CRMClient API response object → flat form state.
 * Works with the UNIFIED CRMClient model (same record for enquiry + client info).
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
  city: client.siteAddress?.city || client.city || '',
  numChildren: client.children?.length ? String(client.children.length) : '',
  ageChildren: client.children?.length
    ? client.children.map((c) => c.age).filter(Boolean).join(', ')
    : '',
});

/**
 * useClientInfo
 *
 * Unified hook for the Client Information Form.
 * In the new architecture, both Enquiry and Client Info write to the SAME
 * CRMClient record. This hook:
 *   1. Fetches the existing CRMClient record (created by Enquiry Form)
 *   2. Prefills ALL fields (name, phone, email from enquiry + any additional data)
 *   3. On submit, UPDATES the same record (PUT /api/clients/update/:id)
 *
 * @param {object} options
 * @param {object}  options.activeLead  – { id, _id, name, phone, email } from CRM context
 * @param {string}  options.clientId    – existing CRMClient._id (same as leadId in unified model)
 * @param {function} options.onSuccess  – callback(client, formData) after successful save
 */
export const useClientInfo = ({ activeLead, clientId, onSuccess } = {}) => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  // In unified model, the "client" IS the lead — same record
  const [existingClientId, setExistingClientId] = useState(clientId || null);

  /**
   * Fetch existing CRMClient record and populate the entire form.
   * This works for BOTH enquiry-only records AND fully-enriched records.
   */
  const fetchExistingClient = useCallback(async (cid) => {
    if (!cid) return;
    setIsFetching(true);
    try {
      // Uses GET /api/clients/get/:id → CRMClient.controller.getClientById
      const response = await crmService.getClientById(cid);
      const client = response?.client || response?.lead;
      if (client) {
        setFormData(clientToFormData(client));
        setExistingClientId(cid);
      }
    } catch {
      // silently ignore – form stays at initial/lead-prefill state
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Destructure to primitives — avoids passing the object itself as a dep
  const _leadId = activeLead?._id || activeLead?.id;
  const _leadName = activeLead?.name;
  const _leadPhone = activeLead?.phone;
  const _leadEmail = activeLead?.email;

  useEffect(() => {
    // In the unified model, clientId === leadId — same document
    const targetId = clientId || _leadId;

    if (targetId) {
      // Always fetch the full record from the unified collection
      // This prefills BOTH enquiry fields AND any client info already entered
      fetchExistingClient(targetId);
    } else if (_leadId) {
      // Fallback: pre-fill from context if no ID to fetch
      setFormData((prev) => ({
        ...prev,
        name: _leadName || '',
        contactNumber: _leadPhone || '',
        email: _leadEmail || '',
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
      // Build payload matching unified CRMClient schema
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
          ? Array.from({ length: Number(formData.numChildren) || 0 }, (_, idx) => ({
            age: formData.ageChildren
              ? Number(formData.ageChildren.split(',').map(s => s.trim())[idx]) || 0
              : 0,
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
      };

      let response;
      // In unified model: leadId IS the clientId — always UPDATE
      const targetId = existingClientId || _leadId;

      if (targetId) {
        // ── UPDATE existing CRMClient record ────────────────────────
        // PUT /api/clients/update/:id → CRMClient.controller.updateClientDetails
        response = await crmService.updateClient(targetId, payload);
        if (!existingClientId) {
          setExistingClientId(targetId);
        }
      } else {
        // ── CREATE new (rare edge case: no lead context) ────────────
        response = await crmService.createClient(payload);
        const newClient = response?.client;
        if (newClient?._id) {
          setExistingClientId(newClient._id);
        }
      }

      setIsSuccess(true);
      const resultClient = response?.client || response?.lead;
      if (onSuccess) {
        onSuccess(resultClient, formData);
      }
      return resultClient;
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
    isUpdate: !!(existingClientId || _leadId),
    handleChange,
    submitClientInfo,
  };
};

export default useClientInfo;
