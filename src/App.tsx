import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import Dashboard from './pages/Dashboard';
import Visualizer from './pages/Visualizer';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import Catalog from './pages/Catalog';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Router>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/visualizer" element={<Visualizer />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Shell>
    </Router>
  );
}
