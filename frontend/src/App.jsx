import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './modules/auth/pages/LoginPage';
import DashboardPage from './modules/dashboard/pages/DashboardPage';
import { NewLeadsPage, EnquiryFormPage, ClientInfoFormPage } from './modules/crm';
import AppLayout from './shared/layouts/AppLayout/AppLayout';
import PublicLayout from './shared/layouts/PublicLayout/PublicLayout';

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
              <PublicLayout>
                <ClientInfoFormPage isPublic={true} />
              </PublicLayout>
            } 
          />
        </Route>

        {/* App shell — renders once, child changes inside Outlet */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/crm/new-leads" element={<NewLeadsPage />} />
          <Route path="/crm/forms/enquiry" element={<EnquiryFormPage />} />
          <Route path="/crm/forms/client-info" element={<ClientInfoFormPage />} />
        </Route>

        {/* Global default redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}