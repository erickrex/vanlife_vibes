import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Top Navigation Bar Component
 * 
 * Simplified navigation for the 3-tab architecture:
 * - Brand logo (VanlifeVibes)
 * - Profile link (when authenticated)
 * - Logout button (when authenticated)
 * 
 * The main navigation (Feed, Dating, Activities) is handled by TabNavigation
 * at the bottom of the screen.
 * 
 * Requirements:
 * - 10.1: Remove Groups feature from main navigation
 * - 10.2: Remove Sessions feature from main navigation
 * - 10.5: Profile page accessible from within each tab via profile icon
 */
function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  
  return (
    <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-zinc-800">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link 
          to={isAuthenticated ? "/feed" : "/"} 
          className="text-xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent"
        >
          VanlifeVibes
        </Link>
        
        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {isAuthenticated ? (
            <>
              {/* Profile link - accessible from all tabs (Requirement 10.5) */}
              <NavLink to="/profile" active={isActive('/profile')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </NavLink>
              <button 
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" active={isActive('/login')}>
                Login
              </NavLink>
              <Link 
                to="/signup"
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, active, children, badge }) {
  return (
    <Link
      to={to}
      className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active 
          ? 'text-white bg-zinc-800' 
          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

export default Navigation;
