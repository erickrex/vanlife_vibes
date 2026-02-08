import { Link, Navigate } from 'react-router-dom';
import SignupForm from '../components/SignupForm';
import { useAuth } from '../contexts/AuthContext';

function SignupPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  return (
    <div className="app-shell flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-zinc-400">Join the van life community</p>
        </div>
        
        {/* Form Card */}
        <div className="app-panel p-6">
          <SignupForm />
        </div>
        
        {/* Footer */}
        <p className="text-center text-zinc-400 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
