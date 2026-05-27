import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import { ToastProvider } from './shared/notifications/ToastProvider';
import LoginPage from './modules/auth/pages/LoginPage';
import DashboardPage from './modules/dashboard/pages/DashboardPage';
import { EnquiryFormPage, ClientInfoFormPage, ClientsListPage } from './modules/crm';
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
  ProposalApprovalPage,
  SentProposalDashboard,
  SentProposalReviewPage,
  ApprovedDashboard,
  CreateProposalPage,
  TemplateEditorPage,
  ProposalReviewPage,
  ProposalTemplatesPage,
  ProposalClientsPage,
} from './modules/proposal';
import { CRMProvider } from './modules/crm/context/CRMContext';
import { PMSProvider } from './modules/pms/context/PMSContext';
import AppLayout from './shared/layouts/AppLayout/AppLayout';
import PublicLayout from './shared/layouts/PublicLayout/PublicLayout';
import ProfilePage from './modules/profile/pages/ProfilePage';
import SettingsPage from './modules/settings/pages/SettingsPage';
import UserManagementPage from './modules/settings/pages/UserManagementPage';
import RolesPermissionsPage from './modules/settings/pages/RolesPermissionsPage';
import ProjectsPage from './modules/pms/pages/ProjectsPage';
import ProjectDetailPage from './modules/pms/pages/ProjectDetailPage';
import ProjectInitiationPage from './modules/pms/pages/ProjectInitiationPage';
import MyTasksPage from './modules/pms/pages/MyTasksPage';
import TaskDetailPage from './modules/pms/pages/TaskDetailPage';
import DrawingLibraryPage from './modules/pms/pages/DrawingLibraryPage';
import VendorDirectoryPage from './modules/pms/pages/VendorDirectoryPage';
import CalendarPage from './modules/pms/pages/CalendarPage';
import ApprovalDashboardPage from './modules/pms/pages/ApprovalDashboardPage';
import DesignerDashboardPage from './modules/pms/pages/DesignerDashboardPage';
import ManagerReviewQueuePage from './modules/pms/pages/ManagerReviewQueuePage';
import AssignTaskPage from './modules/pms/pages/AssignTaskPage';
import ReviewDesignPage from './modules/pms/pages/ReviewDesignPage';
import WhatsAppGroupsPage from './modules/pms/pages/WhatsAppGroupsPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <PMSProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth */}
              <Route path="/login" element={<LoginPage />} />

              {/* Public Routes (Standalone Forms — no auth required) */}
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

              {/* App shell — authenticated, renders once, children change inside Outlet */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* CRM Module */}
                <Route element={<CRMProvider><Outlet /></CRMProvider>}>
                  <Route path="/crm/forms/enquiry"   element={<EnquiryFormPage />} />
                  <Route path="/crm/forms/client-info" element={<ClientInfoFormPage />} />
                  <Route path="/crm/leads/:id"        element={<LeadDetailsPage />} />
                  <Route path="/crm/clients"          element={<ClientsListPage />} />
                  <Route path="/crm/new-leads"        element={<NewLeadsPage />} />
                  <Route path="/crm/meetings"         element={<MeetingsPage />} />
                  <Route path="/crm/follow-ups"       element={<FollowUpsPage />} />
                  <Route path="/crm/qualified"        element={<KITPage />} />
                  <Route path="/crm/converted"        element={<ConvertedPage />} />
                  <Route path="/crm/lost-leads"       element={<LostLeadsPage />} />
                </Route>

                {/* Proposal & Quotation System */}
                <Route element={<CRMProvider><Outlet /></CRMProvider>}>
                  <Route path="/proposal">
                    <Route index                   element={<ProposalDashboard />} />
                    <Route path="list"             element={<ProposalListPage />} />
                    <Route path="create"           element={<CreateProposalPage />} />
                    <Route path="templates">
                      <Route index               element={<ProposalTemplatesPage />} />
                      <Route path="create"       element={<TemplateEditorPage />} />
                      <Route path="edit/:id"     element={<TemplateEditorPage />} />
                    </Route>
                    <Route path="clients"          element={<ProposalClientsPage />} />
                    <Route path="approval"         element={<ProposalApprovalPage />} />
                    <Route path="sent"             element={<SentProposalDashboard />} />
                    <Route path="sent/:id"         element={<SentProposalReviewPage />} />
                    <Route path="approved"         element={<ApprovedDashboard />} />
                    <Route path="review/:id"       element={<ProposalReviewPage />} />
                  </Route>
                </Route>

                {/* PMS — Project Management */}
                <Route path="/projects"                        element={<ProjectsPage />} />
                <Route path="/projects/create"                 element={<ProjectsPage />} />
                <Route path="/projects/initiate/:proposalId"   element={<ProjectInitiationPage />} />
                <Route path="/projects/:id"                    element={<ProjectDetailPage />} />
                {/* /tasks/:id must come BEFORE /tasks to prevent route shadowing */}
                <Route path="/tasks/:id"                       element={<TaskDetailPage />} />
                <Route path="/tasks"                           element={<MyTasksPage />} />

                {/* DDMS — Designer Dashboard (before /drawings to prevent shadowing) */}
                <Route path="/designer/dashboard" element={<DesignerDashboardPage />} />

                {/* DLR — Drawing Library */}
                <Route path="/drawings"                    element={<DrawingLibraryPage />} />
                <Route path="/drawings/pending-approvals"  element={<DrawingLibraryPage />} />

                {/* PMS — New sidebar pages */}
                <Route path="/pms/assign-task"       element={<AssignTaskPage />} />
                <Route path="/pms/review-design"     element={<ReviewDesignPage />} />
                <Route path="/pms/whatsapp-groups"   element={<WhatsAppGroupsPage />} />

                {/* PMS — Legacy routes kept for backward compatibility */}
                <Route path="/pms/calendar"      element={<CalendarPage />} />
                <Route path="/pms/approvals"     element={<ApprovalDashboardPage />} />
                <Route path="/pms/review-queue"  element={<ManagerReviewQueuePage />} />

                {/* Vendor Directory */}
                <Route path="/vendors" element={<VendorDirectoryPage />} />

                {/* Other */}
                <Route path="/profile" element={<ProfilePage />} />

                {/* Settings */}
                <Route path="/settings"                    element={<SettingsPage />} />
                <Route path="/settings/users"              element={<UserManagementPage />} />
                <Route path="/settings/roles-permissions"  element={<RolesPermissionsPage />} />
              </Route>

              {/* Global default redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </PMSProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
