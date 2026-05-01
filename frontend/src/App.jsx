import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './modules/auth/pages/LoginPage';
import DashboardPage from './modules/dashboard/pages/DashboardPage';
import { EnquiryFormPage, ClientInfoFormPage } from './modules/crm';
import {
  NewLeadsPage,
  LeadDetailsPage,
  MeetingsPage,
  FollowUpsPage,
  KITPage,
  ConvertedPage,
  LostLeadsPage,
} from './modules/leads';
import {
  ProposalListPage,
  ProposalDashboard,
  ProposalTemplatesPage,
  ProposalClientsPage,
  ProposalApprovalPage,
  SentProposalsPage,
  ESignReceivedPage,
  ApprovedProposalsPage,
  CreateProposalPage,
  TemplateEditorPage,
  ReviewPage,
} from './modules/proposal';
import { CRMProvider } from './modules/crm/context/CRMContext';
import AppLayout from './shared/layouts/AppLayout/AppLayout';
import PublicLayout from './shared/layouts/PublicLayout/PublicLayout';
import ProfilePage from './modules/profile/pages/ProfilePage';
import SettingsPage from './modules/settings/pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Public Routes (Standalone Forms) */}
        <Route path="/public">
          <Route
            path="client-info"
            element={
              <CRMProvider>
                <PublicLayout>
                  <ClientInfoFormPage isPublic={true} />
                </PublicLayout>
              </CRMProvider>
            }
          />
        </Route>

        {/* App shell — renders once, children change inside Outlet */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* CRM Module wrapped in flow-state provider */}
          <Route element={<CRMProvider><Outlet /></CRMProvider>}>

            {/* --- Forms --- */}
            <Route path="/crm/forms/enquiry"    element={<EnquiryFormPage />} />
            <Route path="/crm/forms/client-info" element={<ClientInfoFormPage />} />

            {/* --- Lead Detail (shared by all pipeline views) --- */}
            <Route path="/crm/leads/:id" element={<LeadDetailsPage />} />

            {/* --- Leads Pipeline --- */}
            <Route path="/crm/new-leads"   element={<NewLeadsPage />} />
            <Route path="/crm/meetings"    element={<MeetingsPage />} />
            <Route path="/crm/follow-ups"  element={<FollowUpsPage />} />
            <Route path="/crm/qualified"   element={<KITPage />} />

            {/* --- Lead Status --- */}
            <Route path="/crm/converted"   element={<ConvertedPage />} />
            <Route path="/crm/lost-leads"  element={<LostLeadsPage />} />

          </Route>

          {/* --- Proposal & Quotation System --- */}
          <Route element={<CRMProvider><Outlet /></CRMProvider>}>
            <Route path="/proposal">
              <Route index element={<ProposalDashboard />} />
              <Route path="list" element={<ProposalListPage />} />
              <Route path="create" element={<CreateProposalPage />} />
              <Route path="templates">
                <Route index element={<ProposalTemplatesPage />} />
                <Route path="create" element={<TemplateEditorPage />} />
                <Route path="edit/:id" element={<TemplateEditorPage />} />
              </Route>
              <Route path="clients" element={<ProposalClientsPage />} />
              <Route path="approval" element={<ProposalApprovalPage />} />
              <Route path="sent" element={<SentProposalsPage />} />
              <Route path="approved" element={<ApprovedProposalsPage />} />
              <Route path="review/:id" element={<ReviewPage />} />
            </Route>
          </Route>

          {/* Other modules */}
          <Route path="/profile"  element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Global default redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}