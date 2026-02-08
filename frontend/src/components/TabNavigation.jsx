import { Link, useLocation } from 'react-router-dom';

/**
 * TabNavigation Component
 * 
 * Bottom navigation bar with three main tabs: Feed, Dating, and Activities.
 * Uses fixed bottom positioning and highlights the active tab.
 * 
 * Requirements:
 * - 1.1: Display exactly three tabs: Feed, Dating, and Activities
 * - 1.5: Display icons and labels for each tab (Feed: compass, Dating: heart, Activities: calendar)
 * 
 * @param {Object} props
 * @param {'feed' | 'dating' | 'activities'} props.activeTab - The currently active tab
 */
function TabNavigation({ activeTab }) {
  const location = useLocation();
  
  // Determine active tab from props or current route
  const getActiveTab = () => {
    if (activeTab) return activeTab;
    
    const path = location.pathname;
    if (path.startsWith('/dating')) return 'dating';
    if (path.startsWith('/activities')) return 'activities';
    if (path.startsWith('/feed') || path === '/') return 'feed';
    return 'feed';
  };
  
  const currentTab = getActiveTab();
  
  const tabs = [
    {
      id: 'feed',
      label: 'Feed',
      path: '/feed',
      icon: CompassIcon,
    },
    {
      id: 'dating',
      label: 'Dating',
      path: '/dating',
      icon: HeartIcon,
    },
    {
      id: 'activities',
      label: 'Activities',
      path: '/activities',
      icon: CalendarIcon,
    },
  ];
  
  return (
    <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 px-4 py-2 z-50 safe-area-pb">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? tab.id === 'dating'
                    ? 'text-rose-400'
                    : tab.id === 'activities'
                      ? 'text-emerald-400'
                      : 'text-blue-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-6 h-6" filled={isActive} />
              <span className={`text-xs font-medium ${
                isActive
                  ? tab.id === 'dating'
                    ? 'text-rose-400'
                    : tab.id === 'activities'
                      ? 'text-emerald-400'
                      : 'text-blue-400'
                  : ''
              }`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Compass/Explore Icon for Feed tab
 */
function CompassIcon({ className, filled }) {
  return (
    <svg
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {filled ? (
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.55 13.8l-4.08-1.81a.996.996 0 01-.46-.46l-1.81-4.08c-.39-.88.59-1.86 1.47-1.47l4.08 1.81c.19.09.37.27.46.46l1.81 4.08c.39.88-.59 1.86-1.47 1.47z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </>
      )}
    </svg>
  );
}

/**
 * Heart Icon for Dating tab
 */
function HeartIcon({ className, filled }) {
  return (
    <svg
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
      />
    </svg>
  );
}

/**
 * Calendar Icon for Activities tab
 */
function CalendarIcon({ className, filled }) {
  return (
    <svg
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {filled ? (
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z" />
      ) : (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      )}
    </svg>
  );
}

export default TabNavigation;
