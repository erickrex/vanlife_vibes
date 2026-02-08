import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { ACTIVITY_TYPES } from '../utils/constants';

/**
 * Time window options
 * Matches the TIME_WINDOW_CHOICES from the backend Event model
 */
const TIME_WINDOWS = [
  { value: 'morning', label: 'Morning', time: '6am - 12pm' },
  { value: 'afternoon', label: 'Afternoon', time: '12pm - 5pm' },
  { value: 'evening', label: 'Evening', time: '5pm - 9pm' },
  { value: 'flexible', label: 'Flexible', time: 'Any time works' },
];

/**
 * Join mode options
 * Matches the JOIN_MODE_CHOICES from the backend Event model
 */
const JOIN_MODES = [
  { 
    value: 'direct', 
    label: 'Direct Join', 
    description: 'Others can join immediately',
    icon: '👋',
  },
  { 
    value: 'swipe', 
    label: 'Swipe to Join', 
    description: 'Others swipe to express interest',
    icon: '💫',
  },
];

/**
 * Event type categories for better organization
 */
const EVENT_TYPE_CATEGORIES = [
  {
    name: 'Social',
    types: ['coffee', 'potluck', 'campfire', 'cowork'],
  },
  {
    name: 'Outdoor',
    types: ['hiking', 'sunrise_hike', 'sunset', 'climbing', 'biking', 'kayaking', 'surfing', 'camping'],
  },
  {
    name: 'Winter',
    types: ['snowboarding', 'skiing'],
  },
  {
    name: 'Other',
    types: ['dog_walk', 'other'],
  },
];

/**
 * CreateEventPage - Unified form to create events (replaces CreatePlanPage and CreateActivityPage)
 * 
 * Features:
 * - Join mode selector (Direct Join vs Swipe to Join)
 * - Event type selector with categories
 * - Date and time window pickers
 * - Location input
 * - Spots slider
 * - Optional description and image URL
 * 
 * **Validates: Requirements REQ-7.2**
 */
function CreateEventPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get initial join_mode from URL params (e.g., /events/create?mode=swipe)
  const initialJoinMode = searchParams.get('mode') || 'direct';
  
  const [formData, setFormData] = useState({
    join_mode: initialJoinMode,
    event_type: '',
    title: '',
    description: '',
    image_url: '',
    event_date: '',
    time_window: 'flexible',
    location: '',
    spots: 6,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});

  /**
   * Get minimum date (today) for date picker
   */
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  /**
   * Handle form field changes
   */
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setError('');
  };

  /**
   * Handle join mode selection
   */
  const handleJoinModeSelect = (mode) => {
    setFormData(prev => ({ ...prev, join_mode: mode }));
    setError('');
  };

  /**
   * Handle event type selection
   */
  const handleEventTypeSelect = (type) => {
    const typeInfo = ACTIVITY_TYPES[type];
    setFormData(prev => ({
      ...prev,
      event_type: type,
      // Auto-fill title based on event type if empty
      title: prev.title || (typeInfo?.label || type),
    }));
    if (errors.event_type) {
      setErrors(prev => ({ ...prev, event_type: '' }));
    }
    setError('');
  };

  /**
   * Validate form before submission
   */
  const validateForm = () => {
    const newErrors = {};
    
    // Join mode validation
    if (!formData.join_mode) {
      newErrors.join_mode = 'Please select a join mode';
    }
    
    // Event type validation
    if (!formData.event_type) {
      newErrors.event_type = 'Please select an event type';
    }
    
    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }
    
    // Date validation
    if (!formData.event_date) {
      newErrors.event_date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.event_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.event_date = 'Date cannot be in the past';
      }
    }
    
    // Time window validation
    if (!formData.time_window) {
      newErrors.time_window = 'Time window is required';
    }
    
    // Location validation
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    } else if (formData.location.length > 100) {
      newErrors.location = 'Location must be 100 characters or less';
    }
    
    // Spots validation
    if (!formData.spots || formData.spots < 1 || formData.spots > 20) {
      newErrors.spots = 'Spots must be between 1 and 20';
    }
    
    // Description validation (optional but max 500 chars)
    if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }
    
    // Image URL validation (optional but must be valid URL if provided)
    if (formData.image_url.trim()) {
      try {
        new URL(formData.image_url);
      } catch {
        newErrors.image_url = 'Please enter a valid URL';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError('');
      
      const response = await eventsAPI.create({
        join_mode: formData.join_mode,
        event_type: formData.event_type,
        title: formData.title.trim(),
        description: formData.description.trim(),
        image_url: formData.image_url.trim() || null,
        event_date: formData.event_date,
        time_window: formData.time_window,
        location: formData.location.trim(),
        spots: formData.spots,
      });
      
      // Navigate to event detail view
      const eventId = response.data.data?.id || response.data.id;
      navigate(`/events/${eventId}`);
    } catch (err) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  // Determine accent color based on join mode
  const accentBg = formData.join_mode === 'swipe' ? 'bg-emerald-500' : 'bg-blue-500';
  const accentBgHover = formData.join_mode === 'swipe' ? 'hover:bg-emerald-600' : 'hover:bg-blue-600';
  const accentBorder = formData.join_mode === 'swipe' ? 'border-emerald-500' : 'border-blue-500';
  const accentBgLight = formData.join_mode === 'swipe' ? 'bg-emerald-600/20' : 'bg-blue-600/20';
  const accentText = formData.join_mode === 'swipe' ? 'text-emerald-400' : 'text-blue-400';
  const accentFocus = formData.join_mode === 'swipe' ? 'focus:border-emerald-500' : 'focus:border-blue-500';

  return (
    <div className="min-h-screen bg-black px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <Link to="/events" className="text-zinc-400 hover:text-white text-sm transition-colors">
            ← Back to Events
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Create an Event</h1>
          <p className="text-zinc-400 text-sm">
            Organize a meetup with fellow nomads. Choose how others can join!
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

          {/* Join Mode Selection */}
          <div>
            <label className="block text-white text-sm font-medium mb-3">
              How can others join? <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {JOIN_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.join_mode === mode.value 
                      ? `${accentBgLight} ${accentBorder}` 
                      : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                  }`}
                  onClick={() => handleJoinModeSelect(mode.value)}
                >
                  <span className="text-2xl block mb-2">{mode.icon}</span>
                  <span className="text-white text-sm font-medium block">{mode.label}</span>
                  <span className="text-zinc-500 text-xs">{mode.description}</span>
                </button>
              ))}
            </div>
            {errors.join_mode && (
              <p className="text-red-400 text-xs mt-2">{errors.join_mode}</p>
            )}
          </div>

          {/* Event Type Selection */}
          <div>
            <label className="block text-white text-sm font-medium mb-3">
              What kind of event? <span className="text-red-400">*</span>
            </label>
            <div className="space-y-4">
              {EVENT_TYPE_CATEGORIES.map((category) => (
                <div key={category.name}>
                  <span className="text-zinc-500 text-xs uppercase tracking-wide mb-2 block">{category.name}</span>
                  <div className="grid grid-cols-4 gap-2">
                    {category.types.map((type) => {
                      const typeInfo = ACTIVITY_TYPES[type];
                      if (!typeInfo) return null;
                      return (
                        <button
                          key={type}
                          type="button"
                          className={`p-3 rounded-xl border text-center transition-all ${
                            formData.event_type === type 
                              ? `${accentBgLight} ${accentBorder}` 
                              : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                          }`}
                          onClick={() => handleEventTypeSelect(type)}
                        >
                          <span className="text-2xl block mb-1">{typeInfo.emoji}</span>
                          <span className="text-white text-xs font-medium block truncate">{typeInfo.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {errors.event_type && (
              <p className="text-red-400 text-xs mt-2">{errors.event_type}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="flex items-center justify-between text-white text-sm font-medium mb-2">
              <span>Title <span className="text-red-400">*</span></span>
              <span className="text-zinc-500 text-xs">{formData.title.length}/100</span>
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Give your event a catchy title..."
              maxLength={100}
              className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none ${accentFocus} ${
                errors.title ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.title && (
              <p className="text-red-400 text-xs mt-1">{errors.title}</p>
            )}
          </div>

          {/* Date and Time Window */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="event_date" className="block text-white text-sm font-medium mb-2">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => handleChange('event_date', e.target.value)}
                min={getMinDate()}
                className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white focus:outline-none ${accentFocus} ${
                  errors.event_date ? 'border-red-500' : 'border-zinc-700'
                }`}
              />
              {errors.event_date && (
                <p className="text-red-400 text-xs mt-1">{errors.event_date}</p>
              )}
            </div>

            <div>
              <label htmlFor="time_window" className="block text-white text-sm font-medium mb-2">
                Time Window <span className="text-red-400">*</span>
              </label>
              <select
                id="time_window"
                value={formData.time_window}
                onChange={(e) => handleChange('time_window', e.target.value)}
                className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white focus:outline-none ${accentFocus} ${
                  errors.time_window ? 'border-red-500' : 'border-zinc-700'
                }`}
              >
                {TIME_WINDOWS.map((tw) => (
                  <option key={tw.value} value={tw.value}>
                    {tw.label} ({tw.time})
                  </option>
                ))}
              </select>
              {errors.time_window && (
                <p className="text-red-400 text-xs mt-1">{errors.time_window}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="flex items-center justify-between text-white text-sm font-medium mb-2">
              <span>Location <span className="text-red-400">*</span></span>
              <span className="text-zinc-500 text-xs">{formData.location.length}/100</span>
            </label>
            <input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g., Joshua Tree, CA or Downtown Austin"
              maxLength={100}
              className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none ${accentFocus} ${
                errors.location ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.location && (
              <p className="text-red-400 text-xs mt-1">{errors.location}</p>
            )}
            <p className="text-zinc-500 text-xs mt-1">
              Keep it general for safety. Exact location can be shared in the group chat.
            </p>
          </div>

          {/* Spots */}
          <div>
            <label htmlFor="spots" className="block text-white text-sm font-medium mb-2">
              Available Spots: <span className={accentText}>{formData.spots}</span> <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 text-sm">1</span>
              <input
                id="spots"
                type="range"
                min="1"
                max="20"
                value={formData.spots}
                onChange={(e) => handleChange('spots', parseInt(e.target.value))}
                className={`flex-1 ${formData.join_mode === 'swipe' ? 'accent-emerald-500' : 'accent-blue-500'}`}
              />
              <span className="text-zinc-500 text-sm">20</span>
            </div>
            {errors.spots && (
              <p className="text-red-400 text-xs mt-1">{errors.spots}</p>
            )}
            <p className="text-zinc-500 text-xs mt-1">
              This includes you! Smaller groups (4-6) tend to have better conversations.
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
              placeholder="Add any details about the event..."
              maxLength={500}
              rows={4}
              className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 resize-none focus:outline-none ${accentFocus} ${
                errors.description ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.description && (
              <p className="text-red-400 text-xs mt-1">{errors.description}</p>
            )}
          </div>

          {/* Image URL (Optional) */}
          <div>
            <label htmlFor="image_url" className="block text-white text-sm font-medium mb-2">
              Image URL <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="image_url"
              type="url"
              value={formData.image_url}
              onChange={(e) => handleChange('image_url', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none ${accentFocus} ${
                errors.image_url ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.image_url && (
              <p className="text-red-400 text-xs mt-1">{errors.image_url}</p>
            )}
            <p className="text-zinc-500 text-xs mt-1">
              Add a photo to make your event stand out!
            </p>
          </div>

          {/* Join Mode Info */}
          <div className={`flex gap-3 p-4 rounded-xl ${
            formData.join_mode === 'swipe' 
              ? 'bg-emerald-900/20 border border-emerald-800/50' 
              : 'bg-blue-900/20 border border-blue-800/50'
          }`}>
            <span className="text-xl">{formData.join_mode === 'swipe' ? '💫' : '👋'}</span>
            <div>
              <p className={`text-sm font-semibold ${formData.join_mode === 'swipe' ? 'text-emerald-200' : 'text-blue-200'}`}>
                {formData.join_mode === 'swipe' ? 'Swipe to Join Mode' : 'Direct Join Mode'}
              </p>
              <p className={`text-sm ${formData.join_mode === 'swipe' ? 'text-emerald-200/80' : 'text-blue-200/80'}`}>
                {formData.join_mode === 'swipe' 
                  ? 'Others will swipe to express interest. When enough people like your event, it becomes a match!'
                  : 'Others can join your event directly. Great for casual meetups where everyone is welcome!'}
              </p>
            </div>
          </div>

          {/* Safety Note */}
          <div className="flex gap-3 p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl">
            <span className="text-xl">💡</span>
            <p className="text-amber-200 text-sm">
              <span className="font-semibold">Safety first:</span> We recommend meeting in public places for first meetups. 
              Share your plans with a friend and trust your instincts!
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="flex-1 px-4 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-semibold rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-3 ${accentBg} ${accentBgHover} disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors`}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateEventPage;
