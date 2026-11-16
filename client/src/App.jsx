import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Compass } from 'lucide-react';
import { AppShell } from './components/layout/AppShell.jsx';
import { Button, EmptyState } from './components/ui/Primitives.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EmployeesListPage from './pages/EmployeesListPage.jsx';
import EmployeeFormPage from './pages/EmployeeFormPage.jsx';
import EmployeeDetailPage from './pages/EmployeeDetailPage.jsx';
import TasksListPage from './pages/TasksListPage.jsx';
import TaskFormPage from './pages/TaskFormPage.jsx';
import TaskDetailPage from './pages/TaskDetailPage.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The workspace route you requested does not exist."
      action={
        <Link to="/">
          <Button variant="primary">Back to Overview</Button>
        </Link>
      }
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="employees" element={<EmployeesListPage />} />
            <Route path="employees/new" element={<EmployeeFormPage />} />
            <Route path="employees/:id" element={<EmployeeDetailPage />} />
            <Route path="employees/:id/edit" element={<EmployeeFormPage />} />
            <Route path="tasks" element={<TasksListPage />} />
            <Route path="tasks/new" element={<TaskFormPage />} />
            <Route path="tasks/:id" element={<TaskDetailPage />} />
            <Route path="tasks/:id/edit" element={<TaskFormPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        <Toaster richColors closeButton position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
