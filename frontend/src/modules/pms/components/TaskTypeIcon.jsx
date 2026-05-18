import React from 'react';
import {
  Wind, PenTool, ChefHat, Droplets, Cpu,
  Box, Lightbulb, LayoutGrid, Ruler,
} from 'lucide-react';

export const TASK_TYPE_CONFIG = {
  ac_coordination:         { label: 'AC Coordination',         Icon: Wind,       color: 'text-[var(--accent-blue)]',  bg: 'bg-[var(--accent-blue)]/10' },
  technical_drawing:       { label: 'Technical Drawing',       Icon: PenTool,    color: 'text-[var(--primary)]',      bg: 'bg-[var(--primary)]/10' },
  kitchen_drawing:         { label: 'Kitchen Drawing',         Icon: ChefHat,    color: 'text-[var(--accent-teal)]',  bg: 'bg-[var(--accent-teal)]/10' },
  bathroom_drawing:        { label: 'Bathroom Drawing',        Icon: Droplets,   color: 'text-[var(--accent-blue)]',  bg: 'bg-[var(--accent-blue)]/10' },
  automation_coordination: { label: 'Automation',              Icon: Cpu,        color: 'text-[var(--warning)]',      bg: 'bg-[var(--warning)]/10' },
  '3d_render':             { label: '3D Render',               Icon: Box,        color: 'text-[var(--primary)]',      bg: 'bg-[var(--primary)]/10' },
  concept_making:          { label: 'Concept Making',          Icon: Lightbulb,  color: 'text-[var(--warning)]',      bg: 'bg-[var(--warning)]/10' },
  furniture_layout:        { label: 'Furniture Layout',        Icon: LayoutGrid, color: 'text-[var(--accent-teal)]',  bg: 'bg-[var(--accent-teal)]/10' },
  site_measurement:        { label: 'Site Measurement',        Icon: Ruler,      color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--border)]' },
};

const TaskTypeIcon = ({ taskType, size = 16, showLabel = false, className = '' }) => {
  const cfg = TASK_TYPE_CONFIG[taskType];
  if (!cfg) return null;
  const { Icon, color, bg, label } = cfg;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
        <Icon size={size} className={color} />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      )}
    </div>
  );
};

export default TaskTypeIcon;
