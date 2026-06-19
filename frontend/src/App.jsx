import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './shared/context/AuthContext';
import { ToastProvider } from './shared/notifications/ToastProvider';
import { NotificationProvider } from './shared/notifications/NotificationContext';
import LoginPage from './modules/auth/pages/LoginPage';
import DashboardPage from './modules/dashboard/pages/DashboardPage';
import CRMDashboardPage from './modules/dashboard/pages/CRMDashboardPage';
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
import ProtectedRoute from './shared/components/ProtectedRoute/ProtectedRoute';
import ProfilePage from './modules/profile/pages/ProfilePage';
import SettingsPage from './modules/settings/pages/SettingsPage';
import UserManagementPage from './modules/settings/pages/UserManagementPage';
import RolesPermissionsPage from './modules/settings/pages/RolesPermissionsPage';
import RolePermissionDetailPage from './modules/settings/pages/RolePermissionDetailPage';
import UserOverrideDetailPage from './modules/settings/pages/UserOverrideDetailPage';
// Phase 3b — Template admin
import ChecklistTemplatesPage from './modules/pms/pages/ChecklistTemplatesPage';
import WorkflowTemplatesPage from './modules/pms/pages/WorkflowTemplatesPage';
import ResponsibilitiesPage from './modules/pms/pages/ResponsibilitiesPage';
// Phase 4 — Analytics
import AnalyticsPage from './modules/pms/pages/AnalyticsPage';
import PMSDashboardPage from './modules/pms/pages/PMSDashboardPage';
import MDDashboardPage from './modules/dashboard/pages/MDDashboardPage';
import ProjectsPage from './modules/pms/pages/ProjectsPage';
import ProjectDetailPage from './modules/pms/pages/ProjectDetailPage';
import MyTasksPage from './modules/pms/pages/MyTasksPage';
import TaskDetailPage from './modules/pms/pages/TaskDetailPage';
import DrawingLibraryPage from './modules/pms/pages/DrawingLibraryPage';
import VendorDirectoryPage from './modules/pms/pages/VendorDirectoryPage';
import CalendarPage from './modules/pms/pages/CalendarPage';
import ApprovalDashboardPage from './modules/pms/pages/ApprovalDashboardPage';
import DesignerDashboardPage from './modules/pms/pages/DesignerDashboardPage';
import ManagerReviewQueuePage from './modules/pms/pages/ManagerReviewQueuePage';
import DesignerDetailPage from './modules/pms/pages/DesignerDetailPage';
import DesignerScoreboardPage from './modules/pms/pages/DesignerScoreboardPage';
import AssignTaskPage from './modules/pms/pages/AssignTaskPage';
import ReviewDesignPage from './modules/pms/pages/ReviewDesignPage';
import WhatsAppGroupsPage from './modules/pms/pages/WhatsAppGroupsPage';
import DocumentRepositoryPage from './modules/pms/pages/DocumentRepositoryPage';
import NotificationsPage from './modules/notifications/pages/NotificationsPage';
import {
  DelegationListPage,
  DelegationDetailPage,
  DelegationDashboardPage,
  DepartmentAdminPage,
  CreateDelegationPage,
} from './modules/delegation';
// KIT — Keep In Touch (communication automation). Aliased to avoid clashing with
// the proposal module's TemplateEditorPage import above.
import {
  TemplateLibraryPage as KitTemplateLibraryPage,
  TemplateEditorPage as KitTemplateEditorPage,
  CampaignsPage as KitCampaignsPage,
  CampaignBuilderPage as KitCampaignBuilderPage,
  AutomationsPage as KitAutomationsPage,
  AutomationBuilderPage as KitAutomationBuilderPage,
  KitSettingsPage,
  AnalyticsPage as KitAnalyticsPage,
} from './modules/kit';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider>
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
                <Route path="/dashboard"     element={<DashboardPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />

                {/* Delegation Management (internal-only MVP) */}
                <Route path="/delegation/departments" element={<ProtectedRoute permission="delegation.department.manage"><DepartmentAdminPage /></ProtectedRoute>} />
                <Route path="/delegation/create" element={<ProtectedRoute permission="delegation.create"><CreateDelegationPage /></ProtectedRoute>} />
                <Route element={<ProtectedRoute permission="delegation.read"><Outlet /></ProtectedRoute>}>
                  <Route path="/delegation"      element={<DelegationDashboardPage />} />
                  <Route path="/delegation/list" element={<DelegationListPage />} />
                  <Route path="/delegation/:id"  element={<DelegationDetailPage />} />
                </Route>

                {/* CRM Module */}
                <Route element={<ProtectedRoute permission="crm.read"><CRMProvider><Outlet /></CRMProvider></ProtectedRoute>}>
                  <Route path="/crm/dashboard"        element={<CRMDashboardPage />} />
                  <Route path="/crm/forms/enquiry"   element={<EnquiryFormPage />} />
                  <Route path="/crm/forms/client-info" element={<ClientInfoFormPage />} />
                  <Route path="/crm/leads/:id"        element={<LeadDetailsPage />} />
                  <Route path="/crm/clients"          element={<ClientsListPage />} />
                  <Route path="/crm/new-leads"        element={<NewLeadsPage />} />
                  <Route path="/crm/meetings"         element={<MeetingsPage />} />
                  {/* Calendar merged into the Meetings tab — redirect old bookmarks */}
                  <Route path="/crm/meetings/calendar" element={<Navigate to="/crm/meetings" replace />} />
                  <Route path="/crm/follow-ups"       element={<FollowUpsPage />} />
                  <Route path="/crm/qualified"        element={<KITPage />} />
                  <Route path="/crm/converted"        element={<ConvertedPage />} />
                  <Route path="/crm/lost-leads"       element={<LostLeadsPage />} />
                </Route>

                {/* Proposal & Quotation System */}
                <Route element={<ProtectedRoute permission="proposal.read"><CRMProvider><Outlet /></CRMProvider></ProtectedRoute>}>
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

                {/* KIT — Keep In Touch (communication automation engine).
                    Feature-flagged: the whole route tree is omitted when
                    VITE_ENABLE_KIT !== 'true' (e.g. client builds), mirroring
                    the VITE_ENABLE_AI gating. */}
                {import.meta.env.VITE_ENABLE_KIT === 'true' && (
                  <Route element={<ProtectedRoute permission="kit.read"><CRMProvider><Outlet /></CRMProvider></ProtectedRoute>}>
                    <Route path="/kit">
                      <Route path="follow-ups" element={<FollowUpsPage />} />
                      <Route path="campaigns">
                        <Route index           element={<KitCampaignsPage />} />
                        <Route path="create"   element={<KitCampaignBuilderPage />} />
                        <Route path=":id"      element={<KitCampaignBuilderPage />} />
                      </Route>
                      <Route path="automations">
                        <Route index           element={<KitAutomationsPage />} />
                        <Route path="create"   element={<KitAutomationBuilderPage />} />
                        <Route path=":id"      element={<KitAutomationBuilderPage />} />
                      </Route>
                      <Route path="whatsapp"   element={<KitTemplateLibraryPage channel="whatsapp" />} />
                      <Route path="mail"       element={<KitTemplateLibraryPage channel="email" />} />
                      <Route path="templates">
                        <Route path="create"   element={<KitTemplateEditorPage />} />
                        <Route path="edit/:id" element={<KitTemplateEditorPage />} />
                      </Route>
                      <Route path="analytics"  element={<KitAnalyticsPage />} />
                      <Route path="settings"   element={<KitSettingsPage />} />
                    </Route>
                  </Route>
                )}

                {/* MD — Executive cross-module dashboard */}
                <Route path="/md/dashboard"                    element={<ProtectedRoute permission="md.dashboard.read"><MDDashboardPage /></ProtectedRoute>} />

                {/* PMS — Project Management */}
                <Route path="/pms/dashboard"                   element={<ProtectedRoute permission="projects.read" excludeRoles={['designer']}><PMSDashboardPage /></ProtectedRoute>} />
                <Route path="/projects"                        element={<ProjectsPage />} />
                <Route path="/projects/create"                 element={<ProjectsPage />} />
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
                <Route path="/pms/assign-task"       element={<ProtectedRoute permission="projects.tab.assign"><AssignTaskPage /></ProtectedRoute>} />
                <Route path="/pms/review-design"     element={<ProtectedRoute permission="projects.tab.review"><ReviewDesignPage /></ProtectedRoute>} />
                <Route path="/pms/whatsapp-groups"   element={<ProtectedRoute permission="pms.whatsapp.manage"><WhatsAppGroupsPage /></ProtectedRoute>} />
                <Route path="/pms/documents"         element={<DocumentRepositoryPage />} />

                {/* PMS — Legacy routes kept for backward compatibility */}
                <Route path="/pms/calendar"      element={<CalendarPage />} />
                <Route path="/pms/approvals"     element={<ApprovalDashboardPage />} />
                <Route path="/pms/review-queue"  element={<ProtectedRoute permission="tasks.approve"><ManagerReviewQueuePage /></ProtectedRoute>} />

                {/* Vendor Directory */}
                <Route path="/vendors" element={<ProtectedRoute permission="vendor.read"><VendorDirectoryPage /></ProtectedRoute>} />

                {/* Other */}
                <Route path="/profile" element={<ProfilePage />} />

                {/* Settings */}
                <Route path="/settings"                    element={<ProtectedRoute permission="settings.read"><SettingsPage /></ProtectedRoute>} />
                <Route path="/settings/users"              element={<ProtectedRoute permission="settings.tab.users"><UserManagementPage /></ProtectedRoute>} />
                <Route path="/settings/roles-permissions"  element={<ProtectedRoute permission="settings.tab.roles"><RolesPermissionsPage /></ProtectedRoute>} />
                <Route path="/settings/roles-permissions/role/:roleId" element={<ProtectedRoute permission="settings.tab.roles"><RolePermissionDetailPage /></ProtectedRoute>} />
                <Route path="/settings/roles-permissions/user/:userId" element={<ProtectedRoute permission="settings.tab.roles"><UserOverrideDetailPage /></ProtectedRoute>} />
                <Route path="/settings/checklist-templates" element={<ProtectedRoute permission="settings.checklists.manage"><ChecklistTemplatesPage /></ProtectedRoute>} />
                <Route path="/settings/workflow-templates"  element={<ProtectedRoute permission="settings.workflows.manage"><WorkflowTemplatesPage /></ProtectedRoute>} />
                <Route path="/settings/responsibilities"    element={<ProtectedRoute roles={['admin', 'md']}><ResponsibilitiesPage /></ProtectedRoute>} />
                {/* Phase 4 — Analytics */}
                <Route path="/pms/analytics" element={<ProtectedRoute permission="reports.read"><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/pms/designers" element={<ProtectedRoute permission="reports.read"><DesignerScoreboardPage /></ProtectedRoute>} />
                <Route path="/pms/designers/:userId" element={<ProtectedRoute permission="reports.read"><DesignerDetailPage /></ProtectedRoute>} />
              </Route>

              {/* Global default redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </BrowserRouter>
          </PMSProvider>
        </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
