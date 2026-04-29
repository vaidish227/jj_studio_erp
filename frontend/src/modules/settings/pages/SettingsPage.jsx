import React, { useState, useMemo } from 'react';
import { Bell, Shield, Palette, Globe, Smartphone, Lock, Users } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import Checkbox from '../../../shared/components/Checkbox/Checkbox';
import CreateUserForm from '../components/CreateUserForm';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general');

  // Get user info to check for Admin role
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || {};
    } catch {
      return {};
    }
  }, []);

  const isAdmin = user.role?.toLowerCase() === 'admin';

  const navItems = [
    { id: 'general', icon: Globe, label: 'General' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'security', icon: Lock, label: 'Security' },
    { id: 'appearance', icon: Palette, label: 'Appearance' },
    { id: 'mobile', icon: Smartphone, label: 'Mobile App' },
    ...(isAdmin ? [{ id: 'users', icon: Users, label: 'User Management' }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation */}
        <div className="md:col-span-1 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                ${activeTab === item.id 
                  ? 'bg-[var(--primary)] text-black shadow-lg shadow-[var(--primary)]/20' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'}
              `}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="md:col-span-2 space-y-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6">General Settings</h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Email Notifications</p>
                      <p className="text-xs text-[var(--text-muted)]">Receive daily lead summaries via email.</p>
                    </div>
                    <Checkbox id="email-notif" checked={true} onChange={() => {}} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Desktop Alerts</p>
                      <p className="text-xs text-[var(--text-muted)]">Show browser notifications for new leads.</p>
                    </div>
                    <Checkbox id="desktop-alert" checked={false} onChange={() => {}} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Public Profile</p>
                      <p className="text-xs text-[var(--text-muted)]">Allow your profile to be visible to other team members.</p>
                    </div>
                    <Checkbox id="public-profile" checked={true} onChange={() => {}} />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--border)] flex justify-end gap-3">
                  <Button variant="ghost">Reset</Button>
                  <Button variant="primary">Save Changes</Button>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Language & Region</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Language</label>
                    <select className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors">
                      <option>English (US)</option>
                      <option>Hindi</option>
                      <option>Gujarati</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Timezone</label>
                    <select className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors">
                      <option>(GMT+05:30) Mumbai, New Delhi</option>
                      <option>(GMT+00:00) UTC</option>
                    </select>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'users' && isAdmin && (
            <CreateUserForm />
          )}

          {activeTab !== 'general' && activeTab !== 'users' && (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-[var(--bg)] rounded-full flex items-center justify-center mb-4 text-[var(--text-muted)]">
                <Shield size={32} />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Module Coming Soon</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1 max-w-xs">
                We're currently working on this feature. It will be available in the next update.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
