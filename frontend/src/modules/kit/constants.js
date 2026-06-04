// Shared front-end constants for the KIT module (mirror backend enums).
import { MessageCircle, Mail, Bell } from 'lucide-react';

export const CHANNELS = {
  whatsapp:     { key: 'whatsapp',     label: 'WhatsApp',     icon: MessageCircle, accent: 'var(--accent-blue)' },
  email:        { key: 'email',        label: 'Email',        icon: Mail,          accent: 'var(--primary)' },
  notification: { key: 'notification', label: 'Notification', icon: Bell,          accent: 'var(--warning)' },
};

export const CATEGORIES = [
  'welcome', 'meeting', 'proposal', 'followup', 'reminder',
  'approval', 'marketing', 'system', 'custom',
];

export const MEDIA_TYPES = ['none', 'image', 'document', 'video'];
