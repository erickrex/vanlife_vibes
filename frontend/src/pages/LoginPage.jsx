import { Link, Navigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../contexts/AuthContext';

function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-zinc-400">Sign in to continue your journey</p>
        </div>
        
        {/* Form Card */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <LoginForm />
        </div>
        
        {/* Footer */}
        <p className="text-center text-zinc-400 text-sm">
          Don't have an account?{' '}
          <Link to="/signup" className="text-blue-500 hover:text-blue-400 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
