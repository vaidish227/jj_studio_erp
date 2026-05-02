import React, { useEffect, useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  IndianRupee, 
  Calendar,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Briefcase,
  PenTool,
  CreditCard,
  Rocket
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import Loader from '../../../shared/components/Loader/Loader';
import ConfirmationModal from '../../../shared/components/ConfirmationModal/ConfirmationModal';
import { crmService } from '../../../shared/services/crmService';
import { formatDateTime, formatDateShort } from '../../../shared/utils/dateUtils';
import { useToast } from '../../../shared/notifications/ToastProvider';

const ApprovedClientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [proposal, setProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await crmService.getProposalById(id);
      setProposal(response.proposal);
    } catch (err) {
      toast.error('Failed to fetch client details');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleStartProject = async () => {
    setIsSubmitting(true);
    try {
      await crmService.updateProposalStatus(id, { 
        status: 'project_started',
        remarks: 'Project officially initiated from approved dashboard.'
      });
      toast.success('Project initiated successfully!');
      setIsConfirmModalOpen(false);
      fetchData(); // Refresh data
    } catch (err) {
      toast.error('Failed to start project');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <Loader fullPage label="Loading client profile..." />;
  if (!proposal) return <div className="p-20 text-center">Proposal not found</div>;

  const { leadId: lead, clientId: client, advancePayment } = proposal;

  const timelineItems = (lead?.interactionHistory || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="min-h-screen bg-[#F9F8F4] -mt-8 -mx-8 px-8 py-8 space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Back Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/proposal/approved')}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-[var(--primary)] transition-all shadow-sm"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Client Profile & History</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
            Proposal #{proposal._id.slice(-8).toUpperCase()} • {client?.name || lead?.name}
          </p>
        </div>
      </div>

      {/* Action Header / Project Initiation Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Rocket size={22} fill="currentColor" fillOpacity={0.2} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-gray-900 tracking-tight">Ready to start the project?</h4>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Finalize the sales process and transition to official project management.</p>
          </div>
        </div>
        
        <Button 
          variant="primary" 
          className={`h-14 px-10 rounded-2xl font-bold uppercase tracking-[0.1em] text-xs shadow-lg shadow-amber-900/5 flex items-center gap-3 border-none transition-all ${
            proposal.status === 'project_started' 
            ? 'bg-[#E3D3A3] text-[#8B7336] opacity-100 cursor-default' 
            : 'bg-[#E3D3A3] text-[#8B7336] hover:bg-[#DBC892]'
          }`}
          disabled={proposal.status === 'project_started'}
          onClick={() => setIsConfirmModalOpen(true)}
        >
          {proposal.status === 'project_started' ? 'PROJECT INITIATED' : 'INITIATE PROJECT'}
          <ArrowLeft size={16} className="rotate-180" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Details & Quotation */}
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Client Info Card */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100/50 space-y-8">
              <div className="flex items-center gap-3 text-amber-600/60 pb-2">
                <User size={18} />
                <h3 className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-400">Client Information</h3>
              </div>
              <div className="space-y-6">
                <DetailItem icon={User} label="Name" value={client?.name || lead?.name} />
                <DetailItem icon={Mail} label="Email" value={client?.email || lead?.email} />
                <DetailItem icon={Phone} label="Phone" value={client?.phone || lead?.phone} />
                <DetailItem icon={MapPin} label="Site Address" value={lead?.siteAddress || 'N/A'} />
              </div>
            </div>

            {/* Proposal Summary Card */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100/50 space-y-8">
              <div className="flex items-center gap-3 text-blue-600/60 pb-2">
                <FileText size={18} />
                <h3 className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-400">Proposal Summary</h3>
              </div>
              <div className="space-y-6">
                <DetailItem icon={Briefcase} label="Project Type" value={lead?.projectType || 'Interior'} />
                <DetailItem icon={IndianRupee} label="Total Amount" value={`₹${Number(proposal.finalAmount).toLocaleString('en-IN')}`} />
                <DetailItem icon={CheckCircle2} label="eSign Status" value="Completed" valueColor="text-emerald-500" />
                <DetailItem icon={Calendar} label="Signed At" value={proposal.esignSignedAt ? formatDateShort(proposal.esignSignedAt) : '01/05/26'} />
              </div>
            </div>
          </div>

          {/* Quotation Table Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900">Quotation Data</h3>
            </div>
            <div className="p-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-300 font-bold border-b border-gray-50">
                    <th className="pb-4 text-left font-bold">Item Name</th>
                    <th className="pb-4 text-center font-bold">Quantity</th>
                    <th className="pb-4 text-right font-bold">Rate</th>
                    <th className="pb-4 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  {proposal.content?.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-4 font-medium">{item.name}</td>
                      <td className="py-4 text-center">{item.qty}</td>
                      <td className="py-4 text-right">₹{Number(item.rate).toLocaleString('en-IN')}</td>
                      <td className="py-4 text-right font-bold">₹{Number(item.amount).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-8 pt-6 border-t border-gray-50 flex justify-end items-center gap-12">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Final Total</span>
                <span className="text-2xl font-black text-gray-900">₹{Number(proposal.finalAmount).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Payment & History */}
        <div className="lg:col-span-4 space-y-8">
          {/* Payment Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 border-t-4 border-t-emerald-500 overflow-hidden">
            <div className="p-8 space-y-8">
              <div className="flex items-center gap-3 text-emerald-500">
                <CreditCard size={18} />
                <h3 className="font-bold uppercase tracking-[0.2em] text-[10px]">Payment Received</h3>
              </div>
              
              <div className="p-8 rounded-[2rem] bg-gray-50/50 border border-gray-100 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Advance Paid</p>
                <h4 className="text-4xl font-black text-gray-800 mt-2">₹{Number(advancePayment?.amount || 10000).toLocaleString('en-IN')}</h4>
              </div>

              <div className="space-y-6 pt-2">
                <DetailItem label="Paid On" value={advancePayment?.paymentDate ? formatDateShort(advancePayment.paymentDate) : '01/05/26'} />
                <DetailItem label="Method" value={advancePayment?.paymentMethod || 'Bank Transfer'} />
                <DetailItem label="Transaction Ref" value={advancePayment?.remarks || 'N/A'} />
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/50 p-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3 text-amber-500">
                <Clock size={18} />
                <h3 className="font-bold uppercase tracking-[0.2em] text-[10px]">Full History</h3>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest">Live</span>
            </div>

            <div className="relative space-y-12 before:absolute before:left-[17px] before:top-4 before:bottom-0 before:w-0.5 before:bg-gray-100">
              {timelineItems.map((event, idx) => (
                <div key={idx} className="relative pl-12 group">
                  <div className={`absolute left-0 top-0.5 w-9 h-9 rounded-full flex items-center justify-center z-10 border-4 border-white transition-all ${
                    event.type === 'project' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <HistoryIcon type={event.type} />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-none">{event.title}</p>
                      <p className="text-[10px] text-gray-300 font-bold mt-1.5 uppercase tracking-tighter">
                        {formatDateShort(event.createdAt)} {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {event.description && (
                      <div className="bg-gray-50/50 border border-gray-100/50 rounded-xl p-3">
                        <p className="text-[11px] leading-relaxed text-gray-500 font-medium">
                          {event.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleStartProject}
        loading={isSubmitting}
        title="Start Official Project"
        message="By clicking proceed, you are officially moving this client from Sales to Project Management."
        confirmText="Yes, Start Project"
        type="success"
      />
    </div>
  );
};

const DetailItem = ({ icon: Icon, label, value, valueColor = 'text-gray-900' }) => (
  <div className="flex items-start gap-4">
    {Icon && <Icon size={16} className="text-gray-200 mt-1 shrink-0" />}
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-300 leading-none mb-2">{label}</p>
      <p className={`text-sm font-bold leading-tight ${valueColor}`}>{value}</p>
    </div>
  </div>
);

const HistoryIcon = ({ type }) => {
  switch (type) {
    case 'proposal': return <FileText size={14} />;
    case 'meeting': return <Calendar size={14} />;
    case 'advance_payment': return <CreditCard size={14} />;
    case 'project': return <Rocket size={14} fill="white" />;
    default: return <Clock size={14} />;
  }
};

export default ApprovedClientDetails;
