import { useState, useEffect } from 'react';
import { User, Mail, Phone, Briefcase, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import { Modal, Button, PhoneInput } from '../../../shared/components';
import Input from '../../../shared/components/Input/Input';
import FormField from '../../../shared/components/FormField/FormField';
import Select from '../../../shared/components/Select/Select';
import { ROLE_OPTIONS } from '../../../shared/constants/permissions';

const FORM_ROLE_OPTIONS = ROLE_OPTIONS
  .filter((r) => r.value !== 'client' && r.value !== 'vendor')
  .map((r) => ({ value: r.value, label: r.label }));

const validate = (data) => {
  const errors = {};
  if (!data.name.trim())  errors.name  = 'Name is required';
  if (!data.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Invalid email';
  if (data.phone && data.phone.trim() && data.phone.replace(/\D/g, '').length < 11)
    errors.phone = 'Include country code — e.g. +91 9876543210';
  return errors;
};

const EditUserModal = ({ isOpen, onClose, user, onSave, isSaving }) => {
  const [form, setForm]     = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setForm({
        name:        user.name        || '',
        email:       user.email       || '',
        phone:       user.phone       || '',
        department:  user.department  || '',
        designation: user.designation || '',
        role:        user.role        || 'designer',
        isActive:    user.isActive    !== false,
      });
      setErrors({});
    }
  }, [user]);

  if (!user) return null;

  const change = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave(user._id, form);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Name + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Full Name">
            <Input
              icon={User}
              value={form.name || ''}
              onChange={(e) => change('name', e.target.value)}
              error={errors.name}
              placeholder="Full name"
            />
          </FormField>
          <FormField label="Email Address">
            <Input
              type="email"
              icon={Mail}
              value={form.email || ''}
              onChange={(e) => change('email', e.target.value)}
              error={errors.email}
              placeholder="email@example.com"
            />
          </FormField>
        </div>

        {/* Phone + Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="WhatsApp Number">
            <PhoneInput
              name="phone"
              value={form.phone || ''}
              onChange={(e) => change('phone', e.target.value)}
              error={errors.phone}
              placeholder="9876543210"
            />
          </FormField>
          <FormField label="Role">
            <Select
              options={FORM_ROLE_OPTIONS}
              value={form.role || 'designer'}
              onChange={(v) => change('role', v)}
            />
          </FormField>
        </div>

        {/* Department + Designation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Department">
            <Input
              icon={Briefcase}
              value={form.department || ''}
              onChange={(e) => change('department', e.target.value)}
              placeholder="e.g. Design, Operations"
            />
          </FormField>
          <FormField label="Designation">
            <Input
              icon={Tag}
              value={form.designation || ''}
              onChange={(e) => change('designation', e.target.value)}
              placeholder="e.g. Senior Designer"
            />
          </FormField>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)]">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Account Status</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {form.isActive ? 'User can log in and use the system' : 'User is blocked from logging in'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => change('isActive', !form.isActive)}
            className="flex items-center gap-2 shrink-0"
          >
            {form.isActive
              ? <ToggleRight size={28} className="text-[var(--success)]" />
              : <ToggleLeft  size={28} className="text-[var(--text-muted)]" />
            }
            <span className={`text-xs font-bold ${form.isActive ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
              {form.isActive ? 'Active' : 'Inactive'}
            </span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-[var(--border)]">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Save Changes
          </Button>
        </div>

      </form>
    </Modal>
  );
};

export default EditUserModal;
