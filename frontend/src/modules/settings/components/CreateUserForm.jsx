import React from 'react';
import { User, Mail, Lock, ShieldCheck } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Input from '../../../shared/components/Input/Input';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';
import Select from '../../../shared/components/Select/Select';
import { useCreateUser } from '../hooks/useCreateUser';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'designer', label: 'Designer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'sales', label: 'Sales' },
];

const CreateUserForm = () => {
  const { formData, errors, isLoading, status, handleChange, handleSubmit } = useCreateUser();

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Create New User</h3>
        <p className="text-sm text-[var(--text-muted)]">Register a new team member with specific access roles.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Full Name">
            <Input
              icon={User}
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={errors.name}
            />
          </FormField>

          <FormField label="Email Address">
            <Input
              type="email"
              icon={Mail}
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
            />
          </FormField>

          <FormField label="Password">
            <Input
              type="password"
              icon={Lock}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              error={errors.password}
            />
          </FormField>

          <FormField label="User Role">
            <Select
              options={ROLE_OPTIONS}
              value={formData.role}
              onChange={(value) => handleChange('role', value)}
            />
          </FormField>
        </div>

        {status.message && (
          <div className={`p-4 rounded-xl text-sm font-medium border ${
            status.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30 text-green-500' 
              : 'bg-red-500/10 border-red-500/30 text-red-500'
          }`}>
            {status.message}
          </div>
        )}

        <div className="pt-4 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            className="px-8"
          >
            Create Account
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default CreateUserForm;
