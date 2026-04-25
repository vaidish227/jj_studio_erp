import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import LeadCard from '../components/LeadCard';
import AddLeadModal from '../components/AddLeadModal';
import Button from '../../../shared/components/Button/Button';

const INITIAL_LEADS = [
  {
    id: 1,
    name: 'Raj Patel',
    phone: '+91 98765 43210',
    city: 'Mumbai',
    project: 'Living Room Renovation - Modern Design',
    date: '4/22/2024',
    status: 'NEW',
    priority: 'high',
  },
  {
    id: 2,
    name: 'Neha Singh',
    phone: '+91 87654 32109',
    city: 'Delhi',
    project: 'Kitchen Design with Island Layout',
    date: '4/23/2024',
    status: 'NEW',
    priority: 'medium',
  },
];

const NewLeadsPage = () => {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      lead.project.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddLead = async (newLead) => {
    // In a real app, this would be an API call
    const leadWithId = { ...newLead, id: Date.now() };
    setLeads([leadWithId, ...leads]);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">New Leads</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {filteredLeads.length} leads found
          </p>
        </div>
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} />
          Add New Lead
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative group max-w-full">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors"
        />
        <input
          type="text"
          placeholder="Search by name, phone, or requirement..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="
            w-full pl-11 pr-4 py-3 text-sm rounded-xl
            bg-[var(--surface)] border border-[var(--border)]
            text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
            focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]
            transition-all duration-200
          "
        />
      </div>

      {/* Lead Cards List */}
      <div className="space-y-4">
        {filteredLeads.length > 0 ? (
          filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onMenuClick={(clickedLead) => console.log('Menu clicked for:', clickedLead)}
            />
          ))
        ) : (
          <div className="text-center py-10 text-[var(--text-muted)]">
            No leads found matching "{searchTerm}"
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddLead}
      />
    </div>
  );
};

export default NewLeadsPage;
