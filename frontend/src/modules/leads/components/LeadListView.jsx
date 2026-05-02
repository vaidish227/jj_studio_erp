import React from 'react';
import { Search, Plus, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LeadCard from './LeadCard';
import Button from '../../../shared/components/Button/Button';

/**
 * Reusable leads list UI — used by all pipeline pages.
 * Props: title, subtitle, statusLabel, emptyMessage, leads, isLoading, error, searchTerm, setSearchTerm, showAddButton
 */
const LeadListView = ({
  title,
  subtitle,
  leads,
  isLoading,
  error,
  statusSummary,
  searchTerm,
  setSearchTerm,
  projectFilter = 'All',
  setProjectFilter,
  onCardClick,
  showAddButton = false,
  emptyMessage = 'No leads found.',
  accentColor = 'var(--primary)',
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 pl-4" style={{ borderColor: accentColor }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {isLoading ? 'Fetching leads...' : `${leads.length} leads found`}
            {subtitle && <span className="ml-2 text-[var(--text-muted)]">• {subtitle}</span>}
          </p>
        </div>
        {showAddButton && (
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            onClick={() => navigate('/crm/forms/enquiry')}
          >
            <Plus size={18} />
            Add New Enquiry
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative group flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors"
          />
          <input
            type="text"
            placeholder="Search by name, phone, city, or project type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all duration-200"
          />
        </div>

        {setProjectFilter && (
          <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] self-start">
            {['All', 'Residential', 'Commercial'].map((type) => (
              <button
                key={type}
                onClick={() => setProjectFilter(type)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${projectFilter === type
                    ? 'bg-[var(--primary)] text-black shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>

      {statusSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'New', value: statusSummary.new },
            { label: 'In Progress', value: statusSummary.inProgress },
            { label: 'Interested', value: statusSummary.interested },
            { label: 'Converted', value: statusSummary.converted },
            { label: 'Lost', value: statusSummary.lost },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
            <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
            <p className="text-sm">Fetching leads...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10 text-[var(--error)] text-sm">{error}</div>
        ) : leads.length > 0 ? (
          leads.map((lead) => (
            <LeadCard
              key={lead._id || lead.id}
              onClick={onCardClick ? () => onCardClick(lead) : undefined}
              lead={{
                ...lead,
                project: lead.projectType,
                date: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—',
              }}
            />
          ))
        ) : (
          <div className="text-center py-24 bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)]">
            <div className="w-16 h-16 rounded-full bg-[var(--bg)] flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-[var(--text-muted)] opacity-40" />
            </div>
            <p className="text-[var(--text-muted)] text-sm">
              {searchTerm ? `No results for "${searchTerm}"` : emptyMessage}
            </p>
            {showAddButton && !searchTerm && (
              <Button
                variant="ghost"
                className="mt-4 text-[var(--primary)]"
                onClick={() => navigate('/crm/forms/enquiry')}
              >
                Create your first enquiry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadListView;
