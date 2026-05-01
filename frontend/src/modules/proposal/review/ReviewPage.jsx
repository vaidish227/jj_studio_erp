import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Printer, 
  Send, 
  CheckCircle, 
  XCircle, 
  Edit3, 
  FileText,
  User,
  MapPin,
  Phone,
  Mail,
  AlertCircle
} from 'lucide-react';
import { 
  Button, 
  Card, 
  SectionCard, 
  ActionBar, 
  ProposalViewer,
  StatusBadge 
} from '../../../shared/components';
import { crmService } from '../../../shared/services/crmService';

const ReviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get current user role
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    fetchProposal();
  }, [id]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const res = await crmService.getProposalById(id);
      if (res?.proposal) {
        setProposal(res.proposal);
      } else {
        setError("Proposal not found.");
      }
    } catch (err) {
      console.error('Failed to fetch proposal:', err);
      setError("Failed to load proposal details.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (status) => {
    try {
      await crmService.updateProposalStatus(id, status);
      fetchProposal();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status. Please try again.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[var(--text-muted)] font-bold animate-pulse uppercase tracking-widest text-xs">Loading Proposal...</p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center space-y-4">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-primary)]">Oops!</h2>
        <p className="text-[var(--text-muted)]">{error || "Something went wrong."}</p>
        <Button variant="primary" onClick={() => navigate('/proposal')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const client = proposal.clientId || proposal.leadId || {};
  const isManager = user?.role?.toLowerCase() === 'admin';
  const status = proposal.status || 'draft';

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-xl transition-colors text-[var(--text-muted)]"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase">
                {proposal.title || 'Proposal Review'}
              </h1>
              <StatusBadge value={status} />
            </div>
            <p className="text-[var(--text-muted)] font-medium">Reviewing details for {client.name || 'Unknown Client'}</p>
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mt-2 bg-[var(--surface)] inline-block px-3 py-1 rounded-lg border border-[var(--border)]">
              Last updated: {new Date(proposal.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* USER ACTIONS */}
          {!isManager && (
            <>
              {(status === 'draft' || status === 'rejected') && (
                <Button 
                  variant="primary" 
                  onClick={() => handleStatusUpdate('pending_approval')}
                  className="bg-[var(--primary)] text-black"
                >
                  <Send size={18} className="mr-2" />
                  Send for Approval
                </Button>
              )}
            </>
          )}

          {/* MANAGER ACTIONS */}
          {isManager && (
            <>
              {status === 'pending_approval' && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => handleStatusUpdate('rejected')}
                    className="text-red-500 border-red-500 hover:bg-red-50"
                  >
                    <XCircle size={18} className="mr-2" />
                    Reject
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => handleStatusUpdate('manager_approved')}
                    className="bg-green-600 hover:bg-green-700 border-none text-white"
                  >
                    <CheckCircle size={18} className="mr-2" />
                    Approve
                  </Button>
                </>
              )}

              {status === 'manager_approved' && (
                <Button 
                  variant="primary" 
                  onClick={() => handleStatusUpdate('sent')}
                  className="bg-blue-600 hover:bg-blue-700 border-none text-white"
                >
                  <Send size={18} className="mr-2" />
                  Send to Client
                </Button>
              )}
            </>
          )}

          {(status === 'draft' || status === 'rejected' || isManager) && (
            <Button 
              variant="outline" 
              onClick={() => navigate(`/proposal/create?id=${id}`)}
              className="border-[var(--border)]"
            >
              <Edit3 size={18} className="mr-2" />
              Edit / Modify
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint} className="border-[var(--border)]">
            <Printer size={18} className="mr-2" />
            Print / PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Client & Status Info */}
        <div className="lg:col-span-1 space-y-6">
          <SectionCard title="Client Details">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Full Name</p>
                  <p className="font-bold text-[var(--text-primary)]">{client.name || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Email Address</p>
                  <p className="font-bold text-[var(--text-primary)]">{client.email || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Phone Number</p>
                  <p className="font-bold text-[var(--text-primary)]">{client.phone || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Address</p>
                  <p className="font-bold text-[var(--text-primary)] leading-relaxed">{client.address || 'N/A'}</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Workflow Status">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <span className="text-sm font-bold text-[var(--text-muted)] uppercase">Current Phase</span>
                <StatusBadge value={status} />
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed italic font-medium px-2">
                {status === 'draft' && "This proposal is currently in draft mode. It hasn't been sent for approval yet."}
                {status === 'pending_approval' && "Waiting for manager review. No changes can be made while pending."}
                {status === 'manager_approved' && "Approved by management. Ready to be sent to the client."}
                {status === 'rejected' && "Proposal has been rejected or requires modification."}
                {status === 'sent' && "Proposal has been successfully dispatched to the client."}
              </p>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Proposal Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden min-h-[800px] flex justify-center p-4 sm:p-8 bg-gray-50/50">
            <ProposalViewer proposal={proposal} client={client} />
          </div>
        </div>
      </div>


    </div>
  );
};

export default ReviewPage;
