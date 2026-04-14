import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Overview from './pages/Overview';
import Sources from './pages/Sources';
import Companies from './pages/Companies';
import Facilities from './pages/Facilities';
import CompanyDetail from './pages/CompanyDetail';
import FacilityDetail from './pages/FacilityDetail';
import StateDetail from './pages/StateDetail';
import Review from './pages/Review';
import Export from './pages/Export';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:id" element={<CompanyDetail />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/facilities/:id" element={<FacilityDetail />} />
        <Route path="/states/:code" element={<StateDetail />} />
        <Route path="/review" element={<Review />} />
        <Route path="/export" element={<Export />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
