import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { plansAPI } from '../services/api';
import { PLAN_TYPE_OPTIONS } from '../utils/plans';

// Time window options
const TIME_WINDOWS = [
  { value: 'morning', label: 'Morning', time: '6am - 12pm' },
  { value: 'afternoon', label: 'Afternoon', time: '12pm - 5pm' },
  { value: 'evening', label: 'Evening', time: '5pm - 9pm' },
  { value: 'flexible', label: 'Flexible', time: 'Any time works' },
];

/**
 * CreatePlanPage - Form to create a new lightweight meetup plan
 * 
 * Features:
 * - Plan type selector
 * - Date and time window pickers
 * - Meetup area input
 * - Max attendees slider
 * 
 * **Validates: Requirements 11.1**
 */
function CreatePlanPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    plan_type: '',
    title: '',
    plan_date: '',
    time_window: 'flexible',
    meetup_area: '',
    description: '',
    max_attendees: 6,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Handle plan type selection
  const handlePlanTypeSelect = (type) => {
    const planType = PLAN_TYPE_OPTIONS.find((item) => item.value === type);
    setFormData(prev => ({
      ...prev,
      plan_type: type,
      // Auto-fill title based on plan type if empty
      title: prev.title || `${planType.label}`,
    }));
    setError('');
  };

  // Validate form
  const validateForm = () => {
    if (!formData.plan_type) {
      setError('Please select a plan type');
      return false;
    }
    if (!formData.title.trim()) {
      setError('Please enter a title');
      return false;
    }
    if (formData.title.length > 100) {
      setError('Title must be 100 characters or less');
      return false;
    }
    if (!formData.plan_date) {
      setError('Please select a date');
      return false;
    }
    if (!formData.meetup_area.trim()) {
      setError('Please enter a meetup area');
      return false;
    }
    if (formData.meetup_area.length > 100) {
      setError('Meetup area must be 100 characters or less');
      return false;
    }
    if (formData.description.length > 500) {
      setError('Description must be 500 characters or less');
      return false;
    }
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError('');
      
      const response = await plansAPI.create({
        plan_type: formData.plan_type,
        title: formData.title.trim(),
        plan_date: formData.plan_date,
        time_window: formData.time_window,
        meetup_area: formData.meetup_area.trim(),
        description: formData.description.trim(),
        max_attendees: formData.max_attendees,
      });
      
      const planId = response.data.data?.id || response.data.id;
      navigate(`/plans/${planId}`);
    } catch (err) {
      setError(err.message || 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <Link to="/plans" className="text-zinc-400 hover:text-white text-sm transition-colors">
            ← Back to Plans
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Create a Plan</h1>
          <p className="text-zinc-400 text-sm">
            Organize a meetup with fellow nomads. Keep it simple and fun!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center justify-between px-4 py-3 bg-red-900/50 border border-red-800 rounded-lg">
              <span className="text-red-300 text-sm">{error}</span>
              <button type="button" onClick={() => setError('')} className="text-red-300 hover:text-white">✕</button>
            </div>
          )}

          {/* Plan Type Selection */}
          <div>
            <label className="block text-white text-sm font-medium mb-3">What kind of meetup?</label>
            <div className="grid grid-cols-2 gap-3">
              {PLAN_TYPE_OPTIONS.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.plan_type === type.value 
                      ? 'bg-blue-600/20 border-blue-500' 
                      : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                  }`}
                  onClick={() => handlePlanTypeSelect(type.value)}
                >
                  <span className="text-white text-sm font-medium block">{type.label}</span>
                  <span className="text-zinc-500 text-xs">{type.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="flex items-center justify-between text-white text-sm font-medium mb-2">
              Title
              <span className="text-zinc-500 text-xs">{formData.title.length}/100</span>
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Give your plan a catchy title..."
              maxLength={100}
              className="app-input"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="plan_date" className="block text-white text-sm font-medium mb-2">Date</label>
              <input
                id="plan_date"
                type="date"
                value={formData.plan_date}
                onChange={(e) => handleChange('plan_date', e.target.value)}
                min={getMinDate()}
                className="app-input"
              />
            </div>

            <div>
              <label htmlFor="time_window" className="block text-white text-sm font-medium mb-2">Time Window</label>
              <select
                id="time_window"
                value={formData.time_window}
                onChange={(e) => handleChange('time_window', e.target.value)}
                className="app-input"
              >
                {TIME_WINDOWS.map((tw) => (
                  <option key={tw.value} value={tw.value}>
                    {tw.label} ({tw.time})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Meetup Area */}
          <div>
            <label htmlFor="meetup_area" className="flex items-center justify-between text-white text-sm font-medium mb-2">
              Meetup Area
              <span className="text-zinc-500 text-xs">{formData.meetup_area.length}/100</span>
            </label>
            <input
              id="meetup_area"
              type="text"
              value={formData.meetup_area}
              onChange={(e) => handleChange('meetup_area', e.target.value)}
              placeholder="e.g., Downtown Austin, Joshua Tree area..."
              maxLength={100}
              className="app-input"
            />
            <p className="text-zinc-500 text-xs mt-1">
              Keep it general for safety. Exact location can be shared in the group chat.
            </p>
          </div>

          {/* Max Attendees */}
          <div>
            <label htmlFor="max_attendees" className="block text-white text-sm font-medium mb-2">
              Max Attendees: <span className="text-blue-400">{formData.max_attendees}</span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 text-sm">1</span>
              <input
                id="max_attendees"
                type="range"
                min="1"
                max="10"
                value={formData.max_attendees}
                onChange={(e) => handleChange('max_attendees', parseInt(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-zinc-500 text-sm">10</span>
            </div>
            <p className="text-zinc-500 text-xs mt-1">
              Smaller groups (4-6) tend to have better conversations!
            </p>
          </div>

          {/* Description (Optional) */}
          <div>
            <label htmlFor="description" className="flex items-center justify-between text-white text-sm font-medium mb-2">
              <span>Description <span className="text-zinc-500 font-normal">(optional)</span></span>
              <span className="text-zinc-500 text-xs">{formData.description.length}/500</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Add any details about the meetup..."
              maxLength={500}
              rows={4}
              className="app-input resize-none"
            />
          </div>

          {/* Safety Note */}
          <div className="flex gap-3 p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl">
            <span className="text-xl">💡</span>
            <p className="text-amber-200 text-sm">
              <span className="font-semibold">Safety first:</span> We recommend meeting in public places for first meetups. 
              Share your plans with a friend and trust your instincts!
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/plans')}
              className="app-btn-secondary flex-1 px-4 py-3"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePlanPage;
