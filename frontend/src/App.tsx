import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { usePreventNavigation } from './hooks/usePreventNavigation';
import HomePage from './pages/HomePage';
import DeliveryPage from './pages/DeliveryPage';
import DeliveryCodePage from './pages/DeliveryCodePage';
import StandbyPage from './pages/StandbyPage';

function App() {
  usePreventNavigation();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StandbyPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/delivery" element={<DeliveryPage />} />
        <Route path="/delivery/:company" element={<DeliveryCodePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
