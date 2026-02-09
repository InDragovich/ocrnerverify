import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { InputDashboard } from './pages/InputDashboard';
import { VerifierDashboard } from './pages/VerifierDashboard';
import { DashboardPage } from './pages/DashboardPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AuditLogPage } from './pages/AuditLogPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/input" element={<InputDashboard />} />
        <Route path="/verify" element={<VerifierDashboard />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/audit-logs" element={<AuditLogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
