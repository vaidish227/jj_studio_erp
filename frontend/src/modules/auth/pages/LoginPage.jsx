import React from 'react';
import { Mail, Lock } from 'lucide-react';

import WaveBackground from '../../../shared/components/WaveBackground/WaveBackground';
import Input from '../../../shared/components/Input/Input';
import Button from '../../../shared/components/Button/Button';
import Checkbox from '../../../shared/components/Checkbox/Checkbox';
import FormField from '../../../shared/components/FormField/FormField';
import RoleSelector from './RoleSelector';
import useLogin from '../hooks/useLogin';

import logo from '../../../assets/JJ-FINAL-LOGO-PNG.png';

const LoginPage = () => {
  const {
    formData,
    errors,
    isLoading,
    apiError,
    handleChange,
    handleSubmit,
  } = useLogin();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10">
      {/* Wave Background */}
      <WaveBackground />

      {/* Login Card */}
      <div className="relative w-full max-w-md bg-[var(--surface)] rounded-3xl shadow-xl shadow-black/10 p-8 sm:p-10">

        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-7">
          <div className="flex items-center gap-3 mb-5">
            <img
              src={logo}
              alt="JJ Studio Logo"
              className="h-10 w-auto object-contain"
            />
            <span className="text-2xl font-bold tracking-tight">
              {/* <span className="text-[var(--text-primary)]">Tech</span> */}
              <span className="text-[var(--primary)]">ERP</span>
            </span>
            
          </div>

          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Welcome back!
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1 text-center">
            Login to access your account and continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          {/* Role Selector */}
          <RoleSelector
            selectedRole={formData.role}
            onChange={(role) => handleChange('role', role)}
          />

          {/* Email */}
          <FormField label="Email Address">
            <Input
              type="email"
              icon={Mail}
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
            />
          </FormField>

          {/* Password */}
          <FormField label="Password">
            <Input
              type="password"
              icon={Lock}
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              error={errors.password}
            />
          </FormField>

          {/* Remember Me + Forgot Password */}
          <div className="flex items-center justify-between">
            <Checkbox
              id="remember-me"
              label="Remember me"
              checked={formData.rememberMe}
              onChange={(e) => handleChange('rememberMe', e.target.checked)}
            />
            <button
              type="button"
              className="text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          {/* API Error */}
          {apiError && (
            <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl px-4 py-3 text-sm text-[var(--error)] font-medium">
              {apiError}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            fullWidth
          >
            Login Now
          </Button>

        </form>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-[var(--text-muted)] text-center">
        © 2025 TechERP. All rights reserved.
      </p>
    </div>
  );
};

export default LoginPage;
