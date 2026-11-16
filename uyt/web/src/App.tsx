import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoading } from './components/ui';
import { isAdmin, useSession } from './state/session';
import AppLayout from './pages/app/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Home from './pages/marketing/Home';
import BranchLanding from './pages/public/BranchLanding';
import OrderPage from './pages/public/OrderPage';
import Orders from './pages/app/Orders';

const History = lazy(() => import('./pages/app/History'));
const Analytics = lazy(() => import('./pages/app/Analytics'));
const BrandSettings = lazy(() => import('./pages/app/BrandSettings'));
const MenuPage = lazy(() => import('./pages/app/Menu'));
const Offers = lazy(() => import('./pages/app/Offers'));
const Branches = lazy(() => import('./pages/app/Branches'));
const Staff = lazy(() => import('./pages/app/Staff'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === 'loading') return <PageLoading />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { role } = useSession();
  if (!role) return <PageLoading />;
  return isAdmin(role) ? <>{children}</> : <Navigate to="/app/orders" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Customer pages (opened from QR codes) */}
        <Route path="/s/:slug" element={<BranchLanding />} />
        <Route path="/o/:orderId" element={<OrderPage />} />
        {/* Merchant app */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="orders" element={<Orders />} />
          <Route path="history" element={<History />} />
          <Route path="analytics" element={<AdminOnly><Analytics /></AdminOnly>} />
          <Route path="brand" element={<AdminOnly><BrandSettings /></AdminOnly>} />
          <Route path="menu" element={<AdminOnly><MenuPage /></AdminOnly>} />
          <Route path="offers" element={<AdminOnly><Offers /></AdminOnly>} />
          <Route path="branches" element={<AdminOnly><Branches /></AdminOnly>} />
          <Route path="staff" element={<AdminOnly><Staff /></AdminOnly>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
