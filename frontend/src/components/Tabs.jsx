import React, { useState } from 'react';
import PropTypes from 'prop-types';

function Tabs({ children, defaultTab }) {
  const tabs = React.Children.toArray(children);
  const [activeTab, setActiveTab] = useState(defaultTab || 0);

  return (
    <div>
      {/* Tab headers */}
      <div className="flex border-b border-zinc-800">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === index 
                ? 'text-blue-500 border-b-2 border-blue-500' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            onClick={() => setActiveTab(index)}
            aria-selected={activeTab === index}
            role="tab"
          >
            {tab.props.label}
            {tab.props.badge > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">
                {tab.props.badge > 9 ? '9+' : tab.props.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Tab content */}
      <div role="tabpanel">
        {tabs[activeTab]}
      </div>
    </div>
  );
}

Tabs.propTypes = {
  children: PropTypes.node.isRequired,
  defaultTab: PropTypes.number,
};

function Tab({ children }) {
  return <div>{children}</div>;
}

Tab.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  badge: PropTypes.number,
};

export { Tabs, Tab };
