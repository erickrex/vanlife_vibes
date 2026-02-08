import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { plansAPI } from '../services/api';
import { PLAN_TYPES, PLAN_TYPE_OPTIONS, normalizePlans } from '../utils/plans';

const TIME_WINDOWS = {
  morning: { label: 'Morning', time: '6am-12pm' },
  afternoon: { label: 'Afternoon', time: '12pm-5pm' },
  evening: { label: 'Evening', time: '5pm-9pm' },
  flexible: { label: 'Flexible', time: 'Any time' },
};

function PlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ plan_type: '', date: '', area: '' });
  const [showFilters, setShowFilters] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {};
      if (filters.plan_type) params.plan_type = filters.plan_type;
      if (filters.date) {
        params.from_date = filters.date;
        params.to_date = filters.date;
      }
      if (filters.area) params.meetup_area = filters.area;
      
      const response = await plansAPI.list(params);
      const data = response.data.data || response.data;
      const planList = Array.isArray(data) ? data : (data.results || []);
      setPlans(normalizePlans(planList));
    } catch (err) {
      setError(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ plan_type: '', date: '', area: '' });
  };

  const hasActiveFilters = filters.plan_type || filters.date || filters.area;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPlanTypeInfo = (type) => PLAN_TYPES[type] || { label: type };
  const getTimeWindowInfo = (window) => TIME_WINDOWS[window] || { label: window, time: '' };

  if (loading && plans.length === 0) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="py-4">
          <Link to="/matches" className="text-blue-500 text-sm hover:underline">
            ← Back to Matches
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Plans</h1>
          <p className="text-zinc-500 text-sm mb-4">
            Browse and join lightweight meetups with fellow nomads.
          </p>
          <button 
            onClick={() => navigate('/plans/create')} 
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
          >
            + Create a Plan
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <button 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              showFilters ? 'border-blue-500/50 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-600'
            }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <span>🔍</span>
            <span className="text-white text-sm font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </button>
          
          {showFilters && (
            <div className="mt-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4">
              <div>
                <label className="text-zinc-400 text-sm block mb-2">Plan Type</label>
                <select
                  value={filters.plan_type}
                  onChange={(e) => handleFilterChange('plan_type', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-zinc-500"
                >
                  <option value="">All Types</option>
                  {PLAN_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-400 text-sm block mb-2">Date</label>
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => handleFilterChange('date', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-sm block mb-2">Area</label>
                <input
                  type="text"
                  placeholder="Search by area..."
                  value={filters.area}
                  onChange={(e) => handleFilterChange('area', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:border-zinc-500"
                />
              </div>

              {hasActiveFilters && (
                <button 
                  className="text-zinc-500 text-sm hover:text-white transition-colors"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm mb-2">{error}</p>
            <button onClick={loadPlans} className="text-red-400 text-sm underline">
              Try Again
            </button>
          </div>
        )}

        {/* Plans List */}
        <div className="space-y-3">
          {plans.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📅</div>
              <h3 className="text-white font-semibold mb-2">No plans found</h3>
              <p className="text-zinc-500 text-sm mb-4">
                {hasActiveFilters 
                  ? 'Try adjusting your filters or create a new plan!'
                  : 'Be the first to create a plan and meet fellow nomads!'}
              </p>
              <button 
                onClick={() => navigate('/plans/create')} 
                className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Create a Plan
              </button>
            </div>
          ) : (
            plans.map((plan) => {
              const typeInfo = getPlanTypeInfo(plan.plan_type);
              const timeInfo = getTimeWindowInfo(plan.time_window);
              const attendeeCount = plan.attendee_count || plan.attendees?.length || 0;
              const isFull = plan.status === 'full' || attendeeCount >= plan.max_attendees;
              
              return (
                <Link 
                  to={`/plans/${plan.id}`} 
                  key={plan.id} 
                  className={`block bg-zinc-900 rounded-xl border p-4 transition-all hover:border-zinc-600 ${
                    isFull ? 'border-zinc-800 opacity-60' : 'border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                      {typeInfo.label}
                    </span>
                    {isFull && (
                      <span className="px-2 py-1 bg-zinc-800 text-zinc-500 rounded text-xs">
                        Full
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-white font-semibold mb-3">{plan.title}</h3>
                  
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span>📅</span>
                      <span>{formatDate(plan.plan_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span>🕐</span>
                      <span>{timeInfo.label} ({timeInfo.time})</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span>📍</span>
                      <span>{plan.meetup_area}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span>👥</span>
                      <span>{attendeeCount}/{plan.max_attendees} attending</span>
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-zinc-500 text-sm mt-3 line-clamp-2">{plan.description}</p>
                  )}

                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <span className="text-zinc-500 text-xs">
                      Created by {plan.created_by?.display_name || 'Anonymous'}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Refresh */}
        {plans.length > 0 && (
          <div className="mt-6 text-center">
            <button 
              onClick={loadPlans} 
              className="text-zinc-500 text-sm hover:text-white transition-colors"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '↻ Refresh Plans'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlansPage;
