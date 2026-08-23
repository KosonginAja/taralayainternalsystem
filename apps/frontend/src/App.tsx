import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PricelistPage } from './pages/PricelistPage';
import { PackagesPage } from './pages/PackagesPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { QuotationBuilderPage } from './pages/QuotationBuilderPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceBuilderPage } from './pages/InvoiceBuilderPage';
import { WalletsPage } from './pages/WalletsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DocumentTemplateEditorPage } from './pages/DocumentTemplateEditorPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { UsersPage } from './pages/UsersPage';
import { PayrollPage } from './pages/PayrollPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { LeadsPage } from './pages/LeadsPage';
import { ReportingPage } from './pages/ReportingPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/clients" element={<ClientsPage />} />
                    <Route path="/pricelist" element={<PricelistPage />} />
                    <Route path="/packages" element={<PackagesPage />} />
                    <Route path="/quotations" element={<QuotationsPage />} />
                    <Route path="/quotations/new" element={<QuotationBuilderPage />} />
                    <Route path="/quotations/:id/edit" element={<QuotationBuilderPage />} />
                    <Route path="/invoices" element={<InvoicesPage />} />
                    <Route path="/invoices/new" element={<InvoiceBuilderPage />} />
                    <Route path="/wallets" element={<WalletsPage />} />
                    <Route path="/documents" element={<DocumentsPage />} />
                    <Route path="/documents/new" element={<DocumentTemplateEditorPage />} />
                    <Route path="/documents/:id/edit" element={<DocumentTemplateEditorPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/payroll" element={<PayrollPage />} />
                    <Route path="/expenses" element={<ExpensesPage />} />
                    <Route path="/leads" element={<LeadsPage />} />
                    <Route path="/reports" element={<ReportingPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;


