import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { InputDashboard } from './pages/InputDashboard';
import { VerifierDashboard } from './pages/VerifierDashboard';

// Placeholder components until standard ones are created to avoid build errors
// const PlaceholderInput = () => <div className="p-10">Input Dashboard Coming Soon</div>;
// const PlaceholderVerify = () => <div className="p-10">Verifier Dashboard Coming Soon</div>;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/input" element={<InputDashboard />} />
        <Route path="/verify" element={<VerifierDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
