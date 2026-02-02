
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
// Import pages lazily or stub them
import Dashboard from './pages/Dashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl max-w-md w-full">
        <h2 className="text-xl font-bold text-red-500 mb-2">Something went wrong</h2>
        <p className="text-slate-400 text-sm mb-4">We encountered an unexpected error.</p>
        <pre className="text-xs text-red-400 bg-red-950/30 p-4 rounded-lg overflow-auto text-left mb-6 max-h-32">
          {error.message}
        </pre>
        <button 
          onClick={resetErrorBoundary}
          className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-6 rounded-xl transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
               <Route index element={<Dashboard />} />
               <Route path="tasks" element={<div>Tasks Page (Coming Soon)</div>} />
               <Route path="admin" element={<div>Admin Panel (Coming Soon)</div>} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
