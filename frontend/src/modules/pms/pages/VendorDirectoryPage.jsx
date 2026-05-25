import React, { useState, useMemo } from 'react';
import { Store, Plus, Phone, Mail, MapPin, Star, Pencil } from 'lucide-react';
import { Button, Loader, SearchInput } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useVendors from '../hooks/useVendors';
import CreateVendorModal from '../components/CreateVendorModal';

const CATEGORIES = ['AC', 'Automation', 'Kitchen', 'Carpentry', 'Electrical', 'Plumbing', 'Other'];

const STATUS_CFG = {
  active:      { label: 'Active',      color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20' },
  inactive:    { label: 'Inactive',    color: 'bg-[var(--border)] text-[var(--text-muted)] border-[var(--border)]' },
  blacklisted: { label: 'Blacklisted', color: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20' },
};

const StarRating = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={11}
        className={n <= Math.round(rating)
          ? 'text-[var(--warning)] fill-[var(--warning)]'
          : 'text-[var(--border)]'}
      />
    ))}
    {rating > 0 && (
      <span className="text-[10px] text-[var(--text-muted)] ml-1">{rating.toFixed(1)}</span>
    )}
  </div>
);

const CATEGORY_COLORS = {
  AC:          'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
  Automation:  'bg-[var(--warning)]/10 text-[var(--warning)]',
  Kitchen:     'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]',
  Carpentry:   'bg-[var(--primary)]/10 text-[var(--primary)]',
  Electrical:  'bg-[var(--warning)]/10 text-[var(--warning)]',
  Plumbing:    'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
  Other:       'bg-[var(--border)] text-[var(--text-muted)]',
};

const VendorCard = ({ vendor, onEdit }) => {
  const statusCfg = STATUS_CFG[vendor.status] || STATUS_CFG.active;

  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3
                    transition-all duration-150 hover:border-[var(--primary)]/40
                    ${vendor.status === 'blacklisted' ? 'opacity-60' : ''}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${CATEGORY_COLORS[vendor.category]}`}>
              {vendor.category}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)] leading-snug">{vendor.name}</p>
          {vendor.contactPerson && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{vendor.contactPerson}</p>
          )}
        </div>
        <PermissionGate permission="vendor.update">
          <button
            type="button"
            onClick={() => onEdit(vendor)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--primary)] transition-colors shrink-0"
          >
            <Pencil size={13} />
          </button>
        </PermissionGate>
      </div>

      {/* Rating */}
      <StarRating rating={vendor.rating || 0} />

      {/* Contact info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Phone size={11} className="shrink-0" />
          <span>{vendor.phone}</span>
        </div>
        {vendor.email && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Mail size={11} className="shrink-0" />
            <span className="truncate">{vendor.email}</span>
          </div>
        )}
        {vendor.address && (
          <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
            <MapPin size={11} className="shrink-0 mt-0.5" />
            <span className="line-clamp-2">{vendor.address}</span>
          </div>
        )}
      </div>

      {vendor.notes && (
        <p className="text-xs text-[var(--text-muted)] italic border-t border-[var(--border)] pt-2 line-clamp-2">
          {vendor.notes}
        </p>
      )}
    </div>
  );
};

const VendorDirectoryPage = () => {
  const { vendors, isLoading, error, category, filterByCategory, refresh } = useVendors();
  const [search, setSearch]       = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]     = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      v.contactPerson?.toLowerCase().includes(q) ||
      v.phone?.includes(q)
    );
  }, [vendors, search]);

  const handleEdit = (vendor) => { setEditing(vendor); setShowCreate(true); };
  const handleClose = () => { setShowCreate(false); setEditing(null); };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
            <Store size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Vendor Directory</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
              {category ? ` · ${category}` : ' · All categories'}
            </p>
          </div>
        </div>
        <PermissionGate permission="vendor.create">
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={15} className="mr-1" />
            Add Vendor
          </Button>
        </PermissionGate>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {['', ...CATEGORIES].map((cat) => (
          <button
            key={cat || 'all'}
            type="button"
            onClick={() => filterByCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${category === cat
                ? 'bg-[var(--primary)] text-black'
                : 'bg-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]'}`}
          >
            {cat || 'All'}
          </button>
        ))}
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, contact, or phone..."
      />

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-[var(--error)] text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <Store size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">
            {search ? 'No vendors match your search.' : 'No vendors added yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => (
            <VendorCard key={v._id} vendor={v} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <CreateVendorModal
        isOpen={showCreate}
        onClose={handleClose}
        editVendor={editing}
        onSaved={() => { handleClose(); refresh(); }}
      />
    </div>
  );
};

export default VendorDirectoryPage;
