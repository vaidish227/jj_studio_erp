import React from 'react';
import { User, Mail, Phone, MapPin, Shield, Camera } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Avatar from '../../../shared/components/Avatar/Avatar';
import Button from '../../../shared/components/Button/Button';

const ProfilePage = () => {
  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  const user = {
    name: savedUser.name || 'Sarah Smith',
    role: savedUser.role || 'Admin',
    email: savedUser.email || 'sarah.smith@jjstudio.com',
    phone: savedUser.phone || '+91 98765 43210',
    location: savedUser.location || 'Mumbai, India',
    joinedDate: savedUser.createdAt ? new Date(savedUser.createdAt).toLocaleDateString() : 'Jan 2024',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">User Profile</h1>
        <Button variant="outline" size="sm">Edit Profile</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1 flex flex-col items-center text-center p-8">
          <div className="mb-4">
            <Avatar name={user.name} size="lg" className="w-24 h-24 bg-[var(--primary)] text-black text-3xl" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{user.name}</h2>
          <p className="text-[var(--text-muted)] text-sm mb-4">{user.role}</p>
          <div className="flex items-center gap-2 px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-xs font-bold uppercase tracking-wider">
            <Shield size={12} />
            <span>Verified Account</span>
          </div>
        </Card>

        {/* Details Card */}
        <Card className="md:col-span-2 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border)]">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Email Address</p>
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <Mail size={16} className="text-[var(--text-muted)]" />
                  <span>{user.email}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Phone Number</p>
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <Phone size={16} className="text-[var(--text-muted)]" />
                  <span>{user.phone}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Location</p>
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <MapPin size={16} className="text-[var(--text-muted)]" />
                  <span>{user.location}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Member Since</p>
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <User size={16} className="text-[var(--text-muted)]" />
                  <span>{user.joinedDate}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border)]">Account Security</h3>
            <div className="flex items-center justify-between p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--surface)] rounded-lg text-[var(--text-primary)]">
                  <Shield size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Password</p>
                  <p className="text-xs text-[var(--text-muted)]">Last changed 3 months ago</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">Change</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
