import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { usePreventNavigation } from './hooks/usePreventNavigation';
import HomePage from './pages/HomePage';
import DeliveryPage from './pages/DeliveryPage';
import DeliveryCodePage from './pages/DeliveryCodePage';
import StandbyPage from './pages/StandbyPage';
import AdminResidentsPage from './pages/AdminResidentsPage';
import OtherReasonPage from './pages/OtherReasonPage';
import NotificationsPage from './pages/NotificationsPage';
import CallResidentPage from './pages/CallResidentPage';
import RealCallPage from './pages/RealCallPage';

function App() {
  usePreventNavigation();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StandbyPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/delivery" element={<DeliveryPage />} />
        <Route path="/delivery/:company" element={<DeliveryCodePage />} />
        <Route path="/other" element={<OtherReasonPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/call" element={<CallResidentPage />} />
        <Route path="/call/real" element={<RealCallPage />} />
        <Route path="/admin/residents" element={<AdminResidentsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
