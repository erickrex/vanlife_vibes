import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profilesAPI, locationsAPI } from '../services/api';
import CityAutocomplete from '../components/CityAutocomplete';

const VEHICLE_TYPE_OPTIONS = [
  { value: 'van', label: 'Van' },
  { value: 'rv', label: 'RV' },
  { value: 'truck_camper', label: 'Truck Camper' },
  { value: 'skoolie', label: 'Skoolie' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'car_camper', label: 'Car Camper' },
  { value: 'other', label: 'Other' },
];

const BUILD_STATUS_OPTIONS = [
  { value: 'stock', label: 'Stock' },
  { value: 'partial', label: 'Partial Build' },
  { value: 'full', label: 'Full Build' },
];

const TRAVEL_STATUS_OPTIONS = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'weekender', label: 'Weekender' },
  { value: 'aspiring', label: 'Aspiring' },
];

const TRAVEL_COMPANIONS_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family' },
  { value: 'with_pets', label: 'With Pets' },
];

const WORK_STATUS_OPTIONS = [
  { value: 'remote_worker', label: 'Remote Worker' },
  { value: 'retired', label: 'Retired' },
  { value: 'seasonal_worker', label: 'Seasonal Worker' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'other', label: 'Other' },
];

const TRAVEL_PACE_OPTIONS = [
  { value: 'slow', label: 'Slow (weeks per spot)' },
  { value: 'mixed', label: 'Mixed (varies)' },
  { value: 'fast', label: 'Fast (moves frequently)' },
];

const PROFILE_TYPE_OPTIONS = [
  { value: 'solo', label: 'Solo', description: 'Traveling alone' },
  { value: 'couple', label: 'Couple', description: 'Traveling as a pair' },
  { value: 'group', label: 'Group', description: 'Traveling with others' },
];

const SOCIAL_VIBE_OPTIONS = [
  { value: 'introvert', label: 'Introvert (need alone time)' },
  { value: 'balanced', label: 'Balanced (depends on mood)' },
  { value: 'social', label: 'Social (energized by people)' },
];

const LIFESTYLE_SCHEDULE_OPTIONS = [
  { value: 'early_bird', label: '🌅 Early Bird' },
  { value: 'night_owl', label: '🦉 Night Owl' },
];

const LIFESTYLE_SOCIAL_OPTIONS = [
  { value: 'quiet', label: '🤫 Quiet' },
  { value: 'party', label: '🎉 Party' },
];

const LIFESTYLE_ENVIRONMENT_OPTIONS = [
  { value: 'outdoors', label: '🏕️ Outdoors' },
  { value: 'city_mix', label: '🏙️ City Mix' },
];

const PET_TYPE_OPTIONS = [
  { value: 'dog', label: '🐕 Dog' },
  { value: 'cat', label: '🐱 Cat' },
  { value: 'other', label: '🐾 Other' },
];

const CAMPING_PREFERENCE_OPTIONS = [
  { value: 'boondocking', label: 'Boondocking' },
  { value: 'campgrounds', label: 'Campgrounds' },
  { value: 'stealth_camping', label: 'Stealth Camping' },
  { value: 'rv_parks', label: 'RV Parks' },
  { value: 'friends_driveways', label: "Friend's Driveways" },
];

const GENDER_OPTIONS = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'non_binary', label: 'Non-binary' },
];

function ProfileEditPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    display_name: '', bio: '', avatar_url: '', cover_url: '', has_van: false,
    looking_for_dating: false, looking_for_friends: true, travel_status: '',
    travel_companions: '', work_status: '', camping_preferences: [], travel_pace: '',
    now_in_city: '', next_week_in_city: '', next_month_in_city: '',
    hobby_ids: [], profile_type: 'solo', group_description: '', rig_status: '',
    social_vibe: '', lifestyle_schedule: '', lifestyle_social: '', lifestyle_environment: '',
    has_pets: false, pet_type: '', pet_friendly_only: false,
    gender: '',
  });
  
  const [vehicleData, setVehicleData] = useState({
    vehicle_type: '', make: '', model: '', year: '', build_status: '', nickname: '',
  });
  
  const [hobbyTags, setHobbyTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [vehicleExpanded, setVehicleExpanded] = useState(false);
  const [inTownWindows, setInTownWindows] = useState([]);
  const [newWindow, setNewWindow] = useState({ city_area: '', start_date: '', end_date: '' });
  const [windowError, setWindowError] = useState('');
  const [addingWindow, setAddingWindow] = useState(false);
  const [deletingWindowId, setDeletingWindowId] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [availablePrompts, setAvailablePrompts] = useState([]);
  const [newPrompt, setNewPrompt] = useState({ prompt_name: '', prompt_answer: '' });
  const [promptError, setPromptError] = useState('');
  const [addingPrompt, setAddingPrompt] = useState(false);
  const [deletingPromptId, setDeletingPromptId] = useState(null);

  useEffect(() => { loadInitialData(); }, []);
  
  useEffect(() => { if (formData.has_van) setVehicleExpanded(true); }, [formData.has_van]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      const [profileRes, hobbiesRes, windowsRes, promptsRes, availablePromptsRes] = await Promise.all([
        profilesAPI.getMyProfile(), profilesAPI.getHobbyTags(),
        profilesAPI.getInTownWindows(), profilesAPI.getPrompts(), profilesAPI.getAvailablePrompts(),
      ]);
      
      const profile = profileRes.data.data || profileRes.data;
      setHobbyTags(hobbiesRes.data.data || hobbiesRes.data);
      setInTownWindows(windowsRes.data.data || windowsRes.data || []);
      setPrompts(promptsRes.data.data || promptsRes.data || []);
      setAvailablePrompts(availablePromptsRes.data.data || availablePromptsRes.data || []);
      
      // Helper to format location from region data
      const formatLocation = (locationData) => {
        if (!locationData) return '';
        if (locationData.region?.name) {
          return `${locationData.region.name}, ${locationData.country?.code || 'US'}`;
        }
        return '';
      };
      
      setFormData({
        display_name: profile.display_name || '', bio: profile.bio || '',
        avatar_url: profile.avatar_url || '', cover_url: profile.cover_url || '',
        gender: profile.gender || '',
        has_van: profile.has_van || false,
        looking_for_dating: profile.looking_for_dating || false,
        looking_for_friends: profile.looking_for_friends !== false,
        travel_status: profile.travel_status || '', travel_companions: profile.travel_companions || '',
        work_status: profile.work_status || '', camping_preferences: profile.camping_preferences || [],
        travel_pace: profile.travel_pace || '',
        now_in_city: profile.now_in_city || formatLocation(profile.now_in),
        next_week_in_city: profile.next_week_in_city || formatLocation(profile.next_week_in),
        next_month_in_city: profile.next_month_in_city || formatLocation(profile.next_month_in),
        hobby_ids: profile.hobbies?.map(h => h.id) || [], profile_type: profile.profile_type || 'solo',
        group_description: profile.group_description || '', rig_status: profile.rig_status || '',
        social_vibe: profile.social_vibe || '', lifestyle_schedule: profile.lifestyle_schedule || '',
        lifestyle_social: profile.lifestyle_social || '', lifestyle_environment: profile.lifestyle_environment || '',
        has_pets: profile.has_pets || false, pet_type: profile.pet_type || '',
        pet_friendly_only: profile.pet_friendly_only || false,
      });

      if (profile.vehicle) {
        setVehicleData({
          vehicle_type: profile.vehicle.vehicle_type || '', make: profile.vehicle.make || '',
          model: profile.vehicle.model || '', year: profile.vehicle.year || '',
          build_status: profile.vehicle.build_status || '', nickname: profile.vehicle.nickname || '',
        });
        if (profile.has_van) setVehicleExpanded(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };
  
  const handleVehicleChange = (e) => {
    const { name, value } = e.target;
    setVehicleData(prev => ({ ...prev, [name]: value }));
  };

  const handleHobbyToggle = (hobbyId) => {
    setFormData(prev => {
      const currentHobbies = prev.hobby_ids;
      if (currentHobbies.includes(hobbyId)) {
        return { ...prev, hobby_ids: currentHobbies.filter(id => id !== hobbyId) };
      }
      return { ...prev, hobby_ids: [...currentHobbies, hobbyId] };
    });
  };
  
  const handleCampingPrefToggle = (pref) => {
    setFormData(prev => {
      const currentPrefs = prev.camping_preferences;
      if (currentPrefs.includes(pref)) {
        return { ...prev, camping_preferences: currentPrefs.filter(p => p !== pref) };
      }
      return { ...prev, camping_preferences: [...currentPrefs, pref] };
    });
  };

  const handleNewWindowChange = (e) => {
    const { name, value } = e.target;
    setNewWindow(prev => ({ ...prev, [name]: value }));
    if (windowError) setWindowError('');
  };

  const validateWindow = () => {
    if (!newWindow.city_area.trim()) { setWindowError('City/area is required'); return false; }
    if (newWindow.city_area.length > 100) { setWindowError('City/area must be 100 characters or less'); return false; }
    if (!newWindow.start_date) { setWindowError('Start date is required'); return false; }
    if (!newWindow.end_date) { setWindowError('End date is required'); return false; }
    if (new Date(newWindow.start_date) > new Date(newWindow.end_date)) { setWindowError('Start date must be before or equal to end date'); return false; }
    if (inTownWindows.length >= 3) { setWindowError('Maximum 3 in-town windows allowed'); return false; }
    return true;
  };

  const handleAddWindow = async () => {
    if (!validateWindow()) return;
    try {
      setAddingWindow(true);
      setWindowError('');
      const response = await profilesAPI.createInTownWindow({
        city_area: newWindow.city_area.trim(), start_date: newWindow.start_date, end_date: newWindow.end_date,
      });
      const createdWindow = response.data.data || response.data;
      setInTownWindows(prev => [...prev, createdWindow]);
      setNewWindow({ city_area: '', start_date: '', end_date: '' });
    } catch (err) {
      setWindowError(err.message || 'Failed to add in-town window');
    } finally {
      setAddingWindow(false);
    }
  };

  const handleDeleteWindow = async (windowId) => {
    try {
      setDeletingWindowId(windowId);
      await profilesAPI.deleteInTownWindow(windowId);
      setInTownWindows(prev => prev.filter(w => w.id !== windowId));
    } catch (err) {
      setWindowError(err.message || 'Failed to delete in-town window');
    } finally {
      setDeletingWindowId(null);
    }
  };

  const handleNewPromptChange = (e) => {
    const { name, value } = e.target;
    setNewPrompt(prev => ({ ...prev, [name]: value }));
    if (promptError) setPromptError('');
  };

  const validatePrompt = () => {
    if (!newPrompt.prompt_name) { setPromptError('Please select a prompt'); return false; }
    if (!newPrompt.prompt_answer.trim()) { setPromptError('Please write an answer'); return false; }
    if (newPrompt.prompt_answer.length > 200) { setPromptError('Answer must be 200 characters or less'); return false; }
    if (prompts.length >= 3) { setPromptError('Maximum 3 prompts allowed'); return false; }
    if (prompts.some(p => p.prompt_name === newPrompt.prompt_name)) { setPromptError('You have already answered this prompt'); return false; }
    return true;
  };

  const handleAddPrompt = async () => {
    if (!validatePrompt()) return;
    try {
      setAddingPrompt(true);
      setPromptError('');
      const response = await profilesAPI.createPrompt({
        prompt_name: newPrompt.prompt_name, prompt_answer: newPrompt.prompt_answer.trim(),
      });
      const createdPrompt = response.data.data || response.data;
      setPrompts(prev => [...prev, createdPrompt]);
      setNewPrompt({ prompt_name: '', prompt_answer: '' });
    } catch (err) {
      setPromptError(err.message || 'Failed to add prompt');
    } finally {
      setAddingPrompt(false);
    }
  };

  const handleDeletePrompt = async (promptId) => {
    try {
      setDeletingPromptId(promptId);
      await profilesAPI.deletePrompt(promptId);
      setPrompts(prev => prev.filter(p => p.id !== promptId));
    } catch (err) {
      setPromptError(err.message || 'Failed to delete prompt');
    } finally {
      setDeletingPromptId(null);
    }
  };

  const getUnusedPrompts = () => {
    const usedQuestions = prompts.map(p => p.prompt_name);
    return availablePrompts.filter(ap => !usedQuestions.includes(ap.prompt_name));
  };

  const getPromptDisplayText = (promptName) => {
    const prompt = availablePrompts.find(ap => ap.prompt_name === promptName);
    return prompt ? prompt.prompt_question : promptName;
  };

  const getPromptPlaceholder = (promptName) => {
    const prompt = availablePrompts.find(ap => ap.prompt_name === promptName);
    return prompt?.prompt_placeholder || 'Write your answer...';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const validate = () => {
    const errors = {};
    if (formData.display_name && formData.display_name.length > 50) errors.display_name = 'Display name must be 50 characters or less';
    if (formData.bio && formData.bio.length > 500) errors.bio = 'Bio must be 500 characters or less';
    if ((formData.profile_type === 'couple' || formData.profile_type === 'group') && formData.group_description && formData.group_description.length > 200) {
      errors.group_description = 'Group description must be 200 characters or less';
    }
    if (!formData.looking_for_dating && !formData.looking_for_friends) errors.looking_for = 'Please select at least one option';
    if (formData.has_van) {
      if (vehicleData.make && vehicleData.make.length > 50) errors.vehicle_make = 'Make must be 50 characters or less';
      if (vehicleData.model && vehicleData.model.length > 50) errors.vehicle_model = 'Model must be 50 characters or less';
      if (vehicleData.nickname && vehicleData.nickname.length > 30) errors.vehicle_nickname = 'Nickname must be 30 characters or less';
      if (vehicleData.year) {
        const year = parseInt(vehicleData.year, 10);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year < 1900 || year > currentYear + 1) errors.vehicle_year = `Year must be between 1900 and ${currentYear + 1}`;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSaving(true);
      setError('');
      const profileUpdate = {
        display_name: formData.display_name, bio: formData.bio,
        avatar_url: formData.avatar_url || null, cover_url: formData.cover_url || null,
        gender: formData.gender || null,
        has_van: formData.has_van,
        looking_for_dating: formData.looking_for_dating, looking_for_friends: formData.looking_for_friends,
        travel_status: formData.travel_status || null, travel_companions: formData.travel_companions || null,
        work_status: formData.work_status || null, camping_preferences: formData.has_van ? formData.camping_preferences : [],
        travel_pace: formData.travel_pace || null,
        now_in_city: formData.now_in_city || null,
        next_week_in_city: formData.next_week_in_city === 'Open plans' ? null : (formData.next_week_in_city || null),
        next_month_in_city: formData.next_month_in_city === 'Open plans' ? null : (formData.next_month_in_city || null),
        hobby_ids: formData.hobby_ids, profile_type: formData.profile_type,
        group_description: (formData.profile_type === 'couple' || formData.profile_type === 'group') ? formData.group_description : '',
        rig_status: formData.rig_status || null, social_vibe: formData.social_vibe || null,
        lifestyle_schedule: formData.lifestyle_schedule || null, lifestyle_social: formData.lifestyle_social || null,
        lifestyle_environment: formData.lifestyle_environment || null, has_pets: formData.has_pets,
        pet_type: formData.has_pets ? (formData.pet_type || null) : null, pet_friendly_only: formData.pet_friendly_only,
      };
      await profilesAPI.updateMyProfile(profileUpdate);
      if (formData.has_van && vehicleData.vehicle_type) {
        const vehicleUpdate = {
          vehicle_type: vehicleData.vehicle_type, make: vehicleData.make || '', model: vehicleData.model || '',
          year: vehicleData.year ? parseInt(vehicleData.year, 10) : null, build_status: vehicleData.build_status || null,
          nickname: vehicleData.nickname || '',
        };
        await profilesAPI.updateMyVehicle(vehicleUpdate);
      } else if (!formData.has_van) {
        try { await profilesAPI.deleteMyVehicle(); } catch {}
      }
      navigate('/profile');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };
  
  const handleCancel = () => navigate('/profile');

  if (loading) {
    return (
      <div className="app-shell pb-20">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-zinc-500">Loading profile...</div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50";
  const selectClass = "w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-zinc-500 focus:outline-none disabled:opacity-50";
  const labelClass = "block text-white text-sm font-medium mb-2";
  const sectionClass = "bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-4";
  const errorClass = "text-red-400 text-xs mt-1";

  return (
    <div className="app-shell pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          <h1 className="text-2xl font-bold text-white mb-6">Edit Profile</h1>
          
          {error && <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">{error}</div>}
          
          {/* Basic Information */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
            
            <div className="mb-4">
              <label className={labelClass}>Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange}
                className={selectClass} disabled={saving}>
                <option value="">Select...</option>
                {GENDER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className={labelClass}>Display Name</label>
              <input type="text" name="display_name" value={formData.display_name} onChange={handleChange}
                className={inputClass} placeholder="Your display name" maxLength={50} disabled={saving} />
              <div className="flex justify-between mt-1">
                <span className={errorClass}>{fieldErrors.display_name}</span>
                <span className="text-zinc-500 text-xs">{formData.display_name.length}/50</span>
              </div>
            </div>
            
            <div className="mb-4">
              <label className={labelClass}>Bio</label>
              <textarea name="bio" value={formData.bio} onChange={handleChange} className={`${inputClass} resize-none`}
                placeholder="Tell others about yourself..." rows={4} maxLength={500} disabled={saving} />
              <div className="flex justify-between mt-1">
                <span className={errorClass}>{fieldErrors.bio}</span>
                <span className="text-zinc-500 text-xs">{formData.bio.length}/500</span>
              </div>
            </div>

            <div className="mb-4">
              <label className={labelClass}>Avatar URL</label>
              <input type="url" name="avatar_url" value={formData.avatar_url} onChange={handleChange}
                className={inputClass} placeholder="https://example.com/avatar.jpg" disabled={saving} />
              <span className="text-zinc-500 text-xs">Enter a URL for your profile picture</span>
            </div>
            
            <div>
              <label className={labelClass}>Cover Photo URL</label>
              <input type="url" name="cover_url" value={formData.cover_url} onChange={handleChange}
                className={inputClass} placeholder="https://example.com/cover.jpg" disabled={saving} />
              <span className="text-zinc-500 text-xs">Enter a URL for your cover photo</span>
            </div>
          </div>

          {/* Profile Type */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">👤 Profile Type</h2>
            <p className="text-zinc-500 text-sm mb-3">Are you traveling solo, as a couple, or with a group?</p>
            <div className="space-y-2">
              {PROFILE_TYPE_OPTIONS.map(option => (
                <label key={option.value} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  formData.profile_type === option.value ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-600'
                }`}>
                  <input type="radio" name="profile_type" value={option.value} checked={formData.profile_type === option.value}
                    onChange={handleChange} disabled={saving} className="sr-only" />
                  <div>
                    <span className="text-white font-medium">{option.label}</span>
                    <span className="text-zinc-500 text-sm block">{option.description}</span>
                  </div>
                </label>
              ))}
            </div>
            {(formData.profile_type === 'couple' || formData.profile_type === 'group') && (
              <div className="mt-4">
                <label className={labelClass}>{formData.profile_type === 'couple' ? 'About Your Duo' : 'About Your Group'}</label>
                <textarea name="group_description" value={formData.group_description} onChange={handleChange}
                  className={`${inputClass} resize-none`} placeholder={formData.profile_type === 'couple' ? "Tell others about you two..." : "Tell others about your group..."}
                  rows={3} maxLength={200} disabled={saving} />
                <div className="flex justify-between mt-1">
                  <span className={errorClass}>{fieldErrors.group_description}</span>
                  <span className="text-zinc-500 text-xs">{formData.group_description.length}/200</span>
                </div>
              </div>
            )}
          </div>

          {/* Looking For */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">💫 Looking For</h2>
            <p className="text-zinc-500 text-sm mb-3">What are you looking for? (Select at least one)</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.looking_for_dating} onChange={(e) => {
                  setFormData(prev => ({ ...prev, looking_for_dating: e.target.checked }));
                  if (fieldErrors.looking_for) setFieldErrors(prev => ({ ...prev, looking_for: '' }));
                }} disabled={saving} className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500" />
                <span className="text-white">💕 Dating</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.looking_for_friends} onChange={(e) => {
                  setFormData(prev => ({ ...prev, looking_for_friends: e.target.checked }));
                  if (fieldErrors.looking_for) setFieldErrors(prev => ({ ...prev, looking_for: '' }));
                }} disabled={saving} className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500" />
                <span className="text-white">👋 Making Friends</span>
              </label>
            </div>
            {fieldErrors.looking_for && <span className={errorClass}>{fieldErrors.looking_for}</span>}
          </div>

          {/* Location */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">📍 Location</h2>
            <p className="text-zinc-500 text-sm mb-4">Let others know where you are and where you're heading</p>
            
            <div className="mb-4">
              <h3 className="text-white text-sm font-medium mb-2">Now In</h3>
              <CityAutocomplete
                value={formData.now_in_city}
                onChange={handleChange}
                name="now_in_city"
                placeholder="Search cities (e.g., Moab, UT)"
                disabled={saving}
              />
            </div>
            
            <div className="mb-4">
              <h3 className="text-white text-sm font-medium mb-2">Next Week In (Optional)</h3>
              <CityAutocomplete
                value={formData.next_week_in_city}
                onChange={handleChange}
                name="next_week_in_city"
                placeholder="Search cities"
                disabled={saving}
              />
            </div>

            <div>
              <h3 className="text-white text-sm font-medium mb-2">Next Month In (Optional)</h3>
              <CityAutocomplete
                value={formData.next_month_in_city}
                onChange={handleChange}
                name="next_month_in_city"
                placeholder="Search cities"
                disabled={saving}
              />
            </div>
          </div>

          {/* In-Town Windows */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">📅 In-Town Windows</h2>
            <p className="text-zinc-500 text-sm mb-3">Let others know where you'll be and when. Add up to 3 windows.</p>
            
            {inTownWindows.length > 0 && (
              <div className="space-y-2 mb-4">
                {inTownWindows.map(window => (
                  <div key={window.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                    <div>
                      <span className="text-white font-medium">📍 {window.city_area}</span>
                      <span className="text-zinc-500 text-sm block">{formatDate(window.start_date)} — {formatDate(window.end_date)}</span>
                    </div>
                    <button type="button" onClick={() => handleDeleteWindow(window.id)} disabled={deletingWindowId === window.id || saving}
                      className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50">
                      {deletingWindowId === window.id ? '...' : '✕'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {inTownWindows.length < 3 && (
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <h4 className="text-white text-sm font-medium mb-3">Add New Window</h4>
                <div className="mb-3">
                  <input type="text" name="city_area" value={newWindow.city_area} onChange={handleNewWindowChange}
                    className={inputClass} placeholder="e.g., San Diego, CA" maxLength={100} disabled={addingWindow || saving} />
                  <span className="text-zinc-500 text-xs">{newWindow.city_area.length}/100</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-zinc-500 text-xs block mb-1">Start Date</label>
                    <input type="date" name="start_date" value={newWindow.start_date} onChange={handleNewWindowChange}
                      className={inputClass} disabled={addingWindow || saving} />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs block mb-1">End Date</label>
                    <input type="date" name="end_date" value={newWindow.end_date} onChange={handleNewWindowChange}
                      className={inputClass} min={newWindow.start_date || undefined} disabled={addingWindow || saving} />
                  </div>
                </div>
                {windowError && <span className={errorClass}>{windowError}</span>}
                <button type="button" onClick={handleAddWindow} disabled={addingWindow || saving}
                  className="w-full py-2 border border-zinc-700 hover:border-zinc-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {addingWindow ? 'Adding...' : '+ Add Window'}
                </button>
              </div>
            )}
            {inTownWindows.length >= 3 && <p className="text-emerald-400 text-sm">✓ Maximum 3 windows reached.</p>}
          </div>

          {/* Profile Prompts */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">💬 Profile Prompts</h2>
            <p className="text-zinc-500 text-sm mb-3">Answer up to 3 prompts to show your personality.</p>
            
            {prompts.length > 0 && (
              <div className="space-y-2 mb-4">
                {prompts.map(prompt => (
                  <div key={prompt.id} className="p-3 bg-zinc-800 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="text-zinc-500 text-xs block mb-1">{getPromptDisplayText(prompt.prompt_name)}</span>
                        <span className="text-white">{prompt.prompt_answer}</span>
                      </div>
                      <button type="button" onClick={() => handleDeletePrompt(prompt.id)} disabled={deletingPromptId === prompt.id || saving}
                        className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50 ml-2">
                        {deletingPromptId === prompt.id ? '...' : '✕'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {prompts.length < 3 && (
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <h4 className="text-white text-sm font-medium mb-3">Add New Prompt</h4>
                <div className="mb-3">
                  <select name="prompt_name" value={newPrompt.prompt_name} onChange={handleNewPromptChange}
                    className={selectClass} disabled={addingPrompt || saving}>
                    <option value="">Choose a prompt...</option>
                    {getUnusedPrompts().map(p => (
                      <option key={p.prompt_name} value={p.prompt_name}>{p.prompt_question}</option>
                    ))}
                  </select>
                </div>
                {newPrompt.prompt_name && (
                  <div className="mb-3">
                    <textarea name="prompt_answer" value={newPrompt.prompt_answer} onChange={handleNewPromptChange}
                      className={`${inputClass} resize-none`} placeholder={getPromptPlaceholder(newPrompt.prompt_name)} rows={3} maxLength={200} disabled={addingPrompt || saving} />
                    <span className={`text-xs ${newPrompt.prompt_answer.length > 180 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                      {newPrompt.prompt_answer.length}/200
                    </span>
                  </div>
                )}
                {promptError && <span className={errorClass}>{promptError}</span>}
                <button type="button" onClick={handleAddPrompt} disabled={addingPrompt || saving || !newPrompt.prompt_name || !newPrompt.prompt_answer.trim()}
                  className="w-full py-2 border border-zinc-700 hover:border-zinc-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {addingPrompt ? 'Adding...' : '+ Add Prompt'}
                </button>
              </div>
            )}
            {prompts.length >= 3 && <p className="text-emerald-400 text-sm">✓ Maximum 3 prompts reached.</p>}
          </div>

          {/* Hobbies */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">🎯 Hobbies</h2>
            <p className="text-zinc-500 text-sm mb-3">Select your interests to connect with like-minded travelers</p>
            <div className="flex flex-wrap gap-2">
              {hobbyTags.map(hobby => (
                <button key={hobby.id} type="button" onClick={() => handleHobbyToggle(hobby.id)} disabled={saving}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    formData.hobby_ids.includes(hobby.id) ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}>
                  {hobby.name}
                </button>
              ))}
            </div>
          </div>

          {/* Lifestyle */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">🏕️ Lifestyle</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Travel Status</label>
                <select name="travel_status" value={formData.travel_status} onChange={handleChange} className={selectClass} disabled={saving}>
                  <option value="">Select...</option>
                  {TRAVEL_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Traveling</label>
                <select name="travel_companions" value={formData.travel_companions} onChange={handleChange} className={selectClass} disabled={saving}>
                  <option value="">Select...</option>
                  {TRAVEL_COMPANIONS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Work Status</label>
                <select name="work_status" value={formData.work_status} onChange={handleChange} className={selectClass} disabled={saving}>
                  <option value="">Select...</option>
                  {WORK_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Travel Pace</label>
                <select name="travel_pace" value={formData.travel_pace} onChange={handleChange} className={selectClass} disabled={saving}>
                  <option value="">Select...</option>
                  {TRAVEL_PACE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>
            
            <div className="mb-4">
              <label className={labelClass}>Social Vibe</label>
              <select name="social_vibe" value={formData.social_vibe} onChange={handleChange} className={selectClass} disabled={saving}>
                <option value="">Select...</option>
                {SOCIAL_VIBE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Lifestyle Preferences</label>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm w-20">Schedule:</span>
                  <div className="flex gap-2">
                    {LIFESTYLE_SCHEDULE_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" disabled={saving}
                        onClick={() => setFormData(prev => ({ ...prev, lifestyle_schedule: prev.lifestyle_schedule === opt.value ? '' : opt.value }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          formData.lifestyle_schedule === opt.value ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm w-20">Social:</span>
                  <div className="flex gap-2">
                    {LIFESTYLE_SOCIAL_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" disabled={saving}
                        onClick={() => setFormData(prev => ({ ...prev, lifestyle_social: prev.lifestyle_social === opt.value ? '' : opt.value }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          formData.lifestyle_social === opt.value ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm w-20">Environment:</span>
                  <div className="flex gap-2">
                    {LIFESTYLE_ENVIRONMENT_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" disabled={saving}
                        onClick={() => setFormData(prev => ({ ...prev, lifestyle_environment: prev.lifestyle_environment === opt.value ? '' : opt.value }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          formData.lifestyle_environment === opt.value ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pet Information */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">🐾 Pet Information</h2>
            <p className="text-zinc-500 text-sm mb-3">Let others know about your furry travel companions</p>
            
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" name="has_pets" checked={formData.has_pets} onChange={(e) => {
                setFormData(prev => ({ ...prev, has_pets: e.target.checked, pet_type: e.target.checked ? prev.pet_type : '' }));
              }} disabled={saving} className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500" />
              <span className="text-white">I travel with pets</span>
            </label>
            
            {formData.has_pets && (
              <div className="mb-4">
                <label className={labelClass}>Pet Type</label>
                <div className="flex gap-2">
                  {PET_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" disabled={saving}
                      onClick={() => setFormData(prev => ({ ...prev, pet_type: prev.pet_type === opt.value ? '' : opt.value }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        formData.pet_type === opt.value ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="pet_friendly_only" checked={formData.pet_friendly_only} onChange={handleChange}
                disabled={saving} className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500" />
              <span className="text-white">🌿 Only show me pet-friendly meetups</span>
            </label>
            <span className="text-zinc-500 text-xs block mt-1 ml-7">Filter your discovery to show only pet-friendly travelers</span>
          </div>

          {/* Vehicle */}
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-white mb-4">🚐 Vehicle</h2>
            
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" name="has_van" checked={formData.has_van} onChange={handleChange}
                disabled={saving} className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500" />
              <span className="text-white">I have a van/rig</span>
            </label>
            
            {formData.has_van && (
              <div>
                <button type="button" onClick={() => setVehicleExpanded(!vehicleExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-zinc-800 rounded-lg mb-3">
                  <span className="text-white font-medium">Vehicle Details</span>
                  <span className="text-zinc-500">{vehicleExpanded ? '▼' : '▶'}</span>
                </button>
                
                {vehicleExpanded && (
                  <div className="space-y-4 p-3 bg-zinc-800/50 rounded-lg">
                    <div>
                      <label className={labelClass}>Vehicle Type</label>
                      <select name="vehicle_type" value={vehicleData.vehicle_type} onChange={handleVehicleChange} className={selectClass} disabled={saving}>
                        <option value="">Select type...</option>
                        {VEHICLE_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    
                    <div>
                      <label className={labelClass}>Nickname</label>
                      <input type="text" name="nickname" value={vehicleData.nickname} onChange={handleVehicleChange}
                        className={inputClass} placeholder="Give your rig a name" maxLength={30} disabled={saving} />
                      <div className="flex justify-between mt-1">
                        <span className={errorClass}>{fieldErrors.vehicle_nickname}</span>
                        <span className="text-zinc-500 text-xs">{vehicleData.nickname.length}/30</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Make</label>
                        <input type="text" name="make" value={vehicleData.make} onChange={handleVehicleChange}
                          className={inputClass} placeholder="e.g., Ford" maxLength={50} disabled={saving} />
                        {fieldErrors.vehicle_make && <span className={errorClass}>{fieldErrors.vehicle_make}</span>}
                      </div>
                      <div>
                        <label className={labelClass}>Model</label>
                        <input type="text" name="model" value={vehicleData.model} onChange={handleVehicleChange}
                          className={inputClass} placeholder="e.g., Transit" maxLength={50} disabled={saving} />
                        {fieldErrors.vehicle_model && <span className={errorClass}>{fieldErrors.vehicle_model}</span>}
                      </div>
                      <div>
                        <label className={labelClass}>Year</label>
                        <input type="number" name="year" value={vehicleData.year} onChange={handleVehicleChange}
                          className={inputClass} placeholder="e.g., 2020" min={1900} max={new Date().getFullYear() + 1} disabled={saving} />
                        {fieldErrors.vehicle_year && <span className={errorClass}>{fieldErrors.vehicle_year}</span>}
                      </div>
                      <div>
                        <label className={labelClass}>Build Status</label>
                        <select name="build_status" value={vehicleData.build_status} onChange={handleVehicleChange} className={selectClass} disabled={saving}>
                          <option value="">Select...</option>
                          {BUILD_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Camping Preferences</label>
                      <div className="flex flex-wrap gap-2">
                        {CAMPING_PREFERENCE_OPTIONS.map(pref => (
                          <button key={pref.value} type="button" onClick={() => handleCampingPrefToggle(pref.value)} disabled={saving}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              formData.camping_preferences.includes(pref.value) ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                            }`}>
                            {pref.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={handleCancel} disabled={saving}
              className="flex-1 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfileEditPage;
