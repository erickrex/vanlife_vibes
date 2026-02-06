import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { activitiesAPI } from '../services/api';

/**
 * Activity type options
 * Matches the ACTIVITY_TYPE_CHOICES from the backend Activity model
 * Requirement 6.3: Activity types include climbing, snowboarding, skiing, hiking, etc.
 */
const ACTIVITY_TYPES = [
  { value: 'climbing', label: 'Climbing', emoji: '🧗' },
  { value: 'snowboarding', label: 'Snowboarding', emoji: '🏂' },
  { value: 'skiing', label: 'Skiing', emoji: '⛷️' },
  { value: 'hiking', label: 'Hiking', emoji: '🥾' },
  { value: 'kayaking', label: 'Kayaking', emoji: '🛶' },
  { value: 'surfing', label: 'Surfing', emoji: '🏄' },
  { value: 'biking', label: 'Biking', emoji: '🚴' },
  { value: 'camping', label: 'Camping', emoji: '🏕️' },
  { value: 'coffee', label: 'Coffee', emoji: '☕' },
  { value: 'cowork', label: 'Cowork', emoji: '💻' },
  { value: 'potluck', label: 'Potluck', emoji: '🍲' },
  { value: 'campfire', label: 'Campfire', emoji: '🔥' },
  { value: 'dog_walk', label: 'Dog Walk', emoji: '🐕' },
  { value: 'sunset', label: 'Sunset', emoji: '🌅' },
  { value: 'sunrise_hike', label: 'Sunrise Hike', emoji: '🌄' },
  { value: 'other', label: 'Other', emoji: '✨' },
];

/**
 * Time window options
 * Matches the TIME_WINDOW_CHOICES from the backend Activity model
 */
const TIME_WINDOWS = [
  { value: 'morning', label: 'Morning', time: '6am - 12pm' },
  { value: 'afternoon', label: 'Afternoon', time: '12pm - 5pm' },
  { value: 'evening', label: 'Evening', time: '5pm - 9pm' },
  { value: 'flexible', label: 'Flexible', time: 'Any time works' },
];

/**
 * CreateActivityPage - Form to create a new activity for swipe-based meetups
 * 
 * Requirements:
 * - 6.1: Require title (max 100 chars), activity_type, date, time window, location/area, spots (1-20)
 * - 6.2: Allow optional description (max 500 chars) and image URL
 * - 6.3: Activity types include climbing, snowboarding, skiing, hiking, kayaking, surfing, etc.
 * - 6.4: Creator is auto-attendee (handled by backend)
 * - 6.5: Status set to 'open' (handled by backend)
 * - 6.6: Validate date is not in past
 * - 6.7: On success, navigate to activity detail view
 */
function CreateActivityPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    activity_type: '',
    description: '',
    image_url: '',
    activity_date: '',
    time_window: 'flexible',
    location: '',
    spots: 4,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});

  /**
   * Get minimum date (today) for date picker
   * Requirement 6.6: Validate date is not in past
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
   * Handle activity type selection
   */
  const handleActivityTypeSelect = (type) => {
    setFormData(prev => ({ ...prev, activity_type: type }));
    if (errors.activity_type) {
      setErrors(prev => ({ ...prev, activity_type: '' }));
    }
    setError('');
  };

  /**
   * Validate form before submission
   * Requirement 6.1: Validate required fields
   * Requirement 6.6: Validate date is not in past
   */
  const validateForm = () => {
    const newErrors = {};
    
    // Title validation (Requirement 6.1)
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }
    
    // Activity type validation (Requirement 6.1)
    if (!formData.activity_type) {
      newErrors.activity_type = 'Please select an activity type';
    }
    
    // Date validation (Requirement 6.1, 6.6)
    if (!formData.activity_date) {
      newErrors.activity_date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.activity_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.activity_date = 'Date cannot be in the past';
      }
    }
    
    // Time window validation (Requirement 6.1)
    if (!formData.time_window) {
      newErrors.time_window = 'Time window is required';
    }
    
    // Location validation (Requirement 6.1)
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    } else if (formData.location.length > 100) {
      newErrors.location = 'Location must be 100 characters or less';
    }
    
    // Spots validation (Requirement 6.1)
    if (!formData.spots || formData.spots < 1 || formData.spots > 20) {
      newErrors.spots = 'Spots must be between 1 and 20';
    }
    
    // Description validation (Requirement 6.2 - optional but max 500 chars)
    if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }
    
    // Image URL validation (Requirement 6.2 - optional but must be valid URL if provided)
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
   * Requirement 6.7: On success, navigate to activity detail view
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError('');
      
      const response = await activitiesAPI.create({
        title: formData.title.trim(),
        activity_type: formData.activity_type,
        description: formData.description.trim(),
        image_url: formData.image_url.trim() || null,
        activity_date: formData.activity_date,
        time_window: formData.time_window,
        location: formData.location.trim(),
        spots: formData.spots,
      });
      
      // Navigate to activity detail view (Requirement 6.7)
      const activityId = response.data.data?.id || response.data.id;
      navigate(`/activities/${activityId}`);
    } catch (err) {
      setError(err.message || 'Failed to create activity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <Link to="/activities" className="text-zinc-400 hover:text-white text-sm transition-colors">
            ← Back to Activities
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Create an Activity</h1>
          <p className="text-zinc-400 text-sm">
            Organize a meetup and let others swipe to join!
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

          {/* Activity Type Selection (Requirement 6.1, 6.3) */}
          <div>
            <label className="block text-white text-sm font-medium mb-3">
              What kind of activity? <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {ACTIVITY_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`p-3 rounded-xl border text-center transition-all ${
                    formData.activity_type === type.value 
                      ? 'bg-emerald-600/20 border-emerald-500' 
                      : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                  }`}
                  onClick={() => handleActivityTypeSelect(type.value)}
                >
                  <span className="text-2xl block mb-1">{type.emoji}</span>
                  <span className="text-white text-xs font-medium block truncate">{type.label}</span>
                </button>
              ))}
            </div>
            {errors.activity_type && (
              <p className="text-red-400 text-xs mt-2">{errors.activity_type}</p>
            )}
          </div>

          {/* Title (Requirement 6.1) */}
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
              placeholder="Give your activity a catchy title..."
              maxLength={100}
              className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 ${
                errors.title ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.title && (
              <p className="text-red-400 text-xs mt-1">{errors.title}</p>
            )}
          </div>

          {/* Date and Time Window (Requirement 6.1, 6.6) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="activity_date" className="block text-white text-sm font-medium mb-2">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                id="activity_date"
                type="date"
                value={formData.activity_date}
                onChange={(e) => handleChange('activity_date', e.target.value)}
                min={getMinDate()}
                className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white focus:outline-none focus:border-emerald-500 ${
                  errors.activity_date ? 'border-red-500' : 'border-zinc-700'
                }`}
              />
              {errors.activity_date && (
                <p className="text-red-400 text-xs mt-1">{errors.activity_date}</p>
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
                className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white focus:outline-none focus:border-emerald-500 ${
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

          {/* Location (Requirement 6.1) */}
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
              className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 ${
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

          {/* Spots (Requirement 6.1) */}
          <div>
            <label htmlFor="spots" className="block text-white text-sm font-medium mb-2">
              Available Spots: <span className="text-emerald-400">{formData.spots}</span> <span className="text-red-400">*</span>
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
                className="flex-1 accent-emerald-500"
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

          {/* Description (Requirement 6.2 - Optional) */}
          <div>
            <label htmlFor="description" className="flex items-center justify-between text-white text-sm font-medium mb-2">
              <span>Description <span className="text-zinc-500 font-normal">(optional)</span></span>
              <span className="text-zinc-500 text-xs">{formData.description.length}/500</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Add any details about the activity..."
              maxLength={500}
              rows={4}
              className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-emerald-500 ${
                errors.description ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.description && (
              <p className="text-red-400 text-xs mt-1">{errors.description}</p>
            )}
          </div>

          {/* Image URL (Requirement 6.2 - Optional) */}
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
              className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 ${
                errors.image_url ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.image_url && (
              <p className="text-red-400 text-xs mt-1">{errors.image_url}</p>
            )}
            <p className="text-zinc-500 text-xs mt-1">
              Add a photo to make your activity stand out!
            </p>
          </div>

          {/* Safety Note */}
          <div className="flex gap-3 p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-xl">
            <span className="text-xl">💡</span>
            <p className="text-emerald-200 text-sm">
              <span className="font-semibold">Safety first:</span> We recommend meeting in public places for first meetups. 
              Share your plans with a friend and trust your instincts!
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/activities')}
              className="flex-1 px-4 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-semibold rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateActivityPage;
