import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profilesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import CityAutocomplete from '../components/CityAutocomplete';

const STEPS = [
  {
    id: 'intent',
    title: 'Welcome',
    subtitle: 'Tell us what you are here for so we can tune your discovery.',
  },
  {
    id: 'basics',
    title: 'Your basics',
    subtitle: 'I am',
  },
  {
    id: 'photo',
    title: 'Your photo',
    subtitle: 'Add a photo to make your profile feel real. You can skip for now.',
  },
  {
    id: 'prefs',
    title: 'Preferences',
    subtitle: 'Set the vibe for who you will see first.',
  },
  {
    id: 'polish',
    title: 'Quick polish',
    subtitle: 'Add two prompts to stand out before you start swiping.',
  },
  {
    id: 'location',
    title: 'Your location',
    subtitle: 'Tell us where you are right now so we can personalize your feed.',
  },
];

const PROFILE_TYPE_OPTIONS = [
  { value: 'solo', label: 'Solo', description: 'Traveling alone' },
  { value: 'couple', label: 'Couple', description: 'Traveling as a pair' },
  { value: 'group', label: 'Group', description: 'Traveling with others' },
];

const TRAVEL_PACE_OPTIONS = [
  { value: 'slow', label: 'Slow', description: 'Weeks per spot' },
  { value: 'mixed', label: 'Mixed', description: 'Varies by trip' },
  { value: 'fast', label: 'Fast', description: 'Moves frequently' },
];

const GENDER_OPTIONS = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'non_binary', label: 'Non-binary' },
];

const PET_TYPE_OPTIONS = [
  { value: 'dog', label: '🐕 Dog' },
  { value: 'cat', label: '🐱 Cat' },
  { value: 'other', label: '🐾 Other' },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    looking_for_dating: false,
    looking_for_friends: true,
    interested_in_men: false,
    interested_in_women: false,
    interested_in_nonbinary: false,
    display_name: '',
    bio: '',
    avatar_url: '',
    gender: '',
    now_in_city: '',
    next_week_in_city: '',
    next_month_in_city: '',
    profile_type: 'solo',
    travel_pace: '',
    has_pets: false,
    pet_type: '',
    prompt_name: '',
    prompt_answer: '',
    prompt_name_2: '',
    prompt_answer_2: '',
  });
  const [availablePrompts, setAvailablePrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState(false);
  const stepData = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const [profileRes, promptsRes] = await Promise.all([
          profilesAPI.getMyProfile(),
          profilesAPI.getAvailablePrompts(),
        ]);
        if (!isMounted) return;
        const profile = profileRes.data.data || profileRes.data;
        const prompts = promptsRes.data.data || promptsRes.data || [];
        setAvailablePrompts(prompts);
        setFormData(prev => ({
          ...prev,
          display_name: profile.display_name || '',
          bio: profile.bio || '',
          avatar_url: profile.avatar_url || '',
          gender: profile.gender || '',
          looking_for_dating: profile.looking_for_dating || false,
          looking_for_friends: profile.looking_for_friends !== false,
          interested_in_men: profile.interested_in_men || false,
          interested_in_women: profile.interested_in_women || false,
          interested_in_nonbinary: profile.interested_in_nonbinary || false,
          now_in_city: profile.now_in_city || '',
          next_week_in_city: profile.next_week_in_city || '',
          next_month_in_city: profile.next_month_in_city || '',
          profile_type: profile.profile_type || 'solo',
          travel_pace: profile.travel_pace || '',
          has_pets: profile.has_pets || false,
          pet_type: profile.pet_type || '',
        }));
      } catch (err) {
        setError(err.message || 'Failed to load onboarding data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (formData.avatar_url) {
      setPhotoError(false);
    }
  }, [formData.avatar_url]);

  const canContinue = useMemo(() => {
    if (!stepData) {
      return false;
    }
    if (stepData.id === 'intent') {
      return formData.looking_for_dating || formData.looking_for_friends;
    }
    if (stepData.id === 'basics') {
      return formData.gender && formData.display_name.trim().length > 0;
    }
    if (stepData.id === 'location') {
      return formData.now_in_city.trim().length > 0;
    }
    if (stepData.id === 'polish') {
      const hasPromptOne = formData.prompt_name && formData.prompt_answer.trim();
      const hasPromptTwo = formData.prompt_name_2 && formData.prompt_answer_2.trim();
      const distinct = formData.prompt_name && formData.prompt_name_2
        ? formData.prompt_name !== formData.prompt_name_2
        : false;
      return hasPromptOne && hasPromptTwo && distinct;
    }
    return true;
  }, [
    formData.gender,
    formData.display_name,
    formData.looking_for_dating,
    formData.looking_for_friends,
    formData.now_in_city,
    formData.prompt_name,
    formData.prompt_name_2,
    formData.prompt_answer,
    formData.prompt_answer_2,
    stepData,
  ]);

  const handleNext = () => {
    setError('');
    if (!stepData) return;
    if (stepData.id === 'intent' && !canContinue) {
      setError('Select at least one option to continue.');
      return;
    }
    if (stepData.id === 'basics') {
      if (!formData.display_name.trim()) {
        setError('Display name is required.');
        return;
      }
      if (!formData.gender) {
        setError('Select a gender to continue.');
        return;
      }
      if (formData.display_name.length > 50) {
        setError('Display name must be 50 characters or fewer.');
        return;
      }
      if (formData.bio.length > 500) {
        setError('Bio must be 500 characters or fewer.');
        return;
      }
    }
    if (stepData.id === 'polish') {
      if (!formData.prompt_name || !formData.prompt_answer.trim()) {
        setError('Add a prompt and answer for Prompt 1.');
        return;
      }
      if (!formData.prompt_name_2 || !formData.prompt_answer_2.trim()) {
        setError('Add a prompt and answer for Prompt 2.');
        return;
      }
      if (formData.prompt_name === formData.prompt_name_2) {
        setError('Choose two different prompts.');
        return;
      }
    }
    setStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError('');
    setStep(prev => Math.max(prev - 1, 0));
  };

  const handleFinish = async () => {
    setError('');
    if (!formData.display_name.trim()) {
      setError('Display name is required.');
      setStep(1);
      return;
    }
    if (!formData.now_in_city.trim()) {
      setError('Your current location is required.');
      setStep(5);
      return;
    }
    if (!formData.prompt_name || !formData.prompt_answer.trim()) {
      setError('Add a prompt and answer for Prompt 1.');
      setStep(4);
      return;
    }
    if (!formData.prompt_name_2 || !formData.prompt_answer_2.trim()) {
      setError('Add a prompt and answer for Prompt 2.');
      setStep(4);
      return;
    }
    if (formData.prompt_name === formData.prompt_name_2) {
      setError('Choose two different prompts.');
      setStep(4);
      return;
    }
    if (formData.looking_for_dating && relationshipPrompts.length === 0) {
      setError('Dating prompts are not available yet. Please try again later.');
      setStep(4);
      return;
    }
    if (!formData.looking_for_dating && relationshipPrompts.length === 0) {
      setError('Friendship prompts are not available yet. Please try again later.');
      setStep(4);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        display_name: formData.display_name.trim(),
        bio: formData.bio || '',
        avatar_url: formData.avatar_url || null,
        gender: formData.gender || null,
        looking_for_dating: !!formData.looking_for_dating,
        looking_for_friends: !!formData.looking_for_friends,
        interested_in_men: !!formData.interested_in_men,
        interested_in_women: !!formData.interested_in_women,
        interested_in_nonbinary: !!formData.interested_in_nonbinary,
        now_in_city: formData.now_in_city.trim(),
        next_week_in_city: formData.next_week_in_city.trim() || null,
        next_month_in_city: formData.next_month_in_city.trim() || null,
        profile_type: formData.profile_type || 'solo',
        travel_pace: formData.travel_pace || null,
        has_pets: !!formData.has_pets,
        pet_type: formData.has_pets ? (formData.pet_type || null) : null,
        has_completed_onboarding: true,
      };

      await profilesAPI.updateMyProfile(payload);

      if (formData.prompt_name && formData.prompt_answer.trim()) {
        await profilesAPI.createPrompt({
          prompt_name: formData.prompt_name,
          prompt_answer: formData.prompt_answer.trim(),
        });
      }
      if (formData.prompt_name_2 && formData.prompt_answer_2.trim()) {
        await profilesAPI.createPrompt({
          prompt_name: formData.prompt_name_2,
          prompt_answer: formData.prompt_answer_2.trim(),
        });
      }

      await refreshProfile();
      navigate(payload.looking_for_dating ? '/dating' : '/feed');
    } catch (err) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  const intentButton = (active) =>
    `w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
      active
        ? 'border-[var(--onboard-accent)] bg-[rgba(244,162,97,0.12)]'
        : 'border-[var(--onboard-border)] bg-[var(--onboard-card)] hover:border-[var(--onboard-accent)]'
    }`;

  const optionButton = (active) =>
    `w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
      active
        ? 'border-[var(--onboard-accent)] bg-[rgba(244,162,97,0.12)]'
        : 'border-[var(--onboard-border)] bg-[var(--onboard-card)] hover:border-[var(--onboard-accent)]'
    }`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500">Loading onboarding...</div>
      </div>
    );
  }

  const travelPrompts = availablePrompts.filter(prompt => prompt.prompt_type === 'travel');
  const relationshipPrompts = availablePrompts.filter(prompt => (
    formData.looking_for_dating ? prompt.prompt_type === 'dating' : prompt.prompt_type === 'friendship'
  ));
  const selectedPromptOne = travelPrompts.find(prompt => prompt.prompt_name === formData.prompt_name);
  const selectedPromptTwo = relationshipPrompts.find(prompt => prompt.prompt_name === formData.prompt_name_2);
  const promptOnePlaceholder = selectedPromptOne?.prompt_placeholder || 'Keep it light and true to you.';
  const promptTwoPlaceholder = selectedPromptTwo?.prompt_placeholder || 'Add another detail people can ask you about.';

  return (
    <div
      className="min-h-screen relative overflow-hidden text-[var(--onboard-ink)]"
      style={{
        '--onboard-ink': '#f6f2ea',
        '--onboard-muted': '#bfb6a7',
        '--onboard-accent': '#f4a261',
        '--onboard-accent-2': '#e76f51',
        '--onboard-card': '#141210',
        '--onboard-border': '#2a2622',
      }}
    >
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,_rgba(244,162,97,0.35),_transparent_65%)] blur-2xl" />
      <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(231,111,81,0.35),_transparent_65%)] blur-2xl" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(10,9,8,0.92)_0%,_rgba(10,9,8,0.96)_40%,_rgba(10,9,8,1)_100%)]" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--onboard-muted)]">Profile setup</p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--onboard-ink)]">{stepData.title}</h1>
          </div>
          <div className="text-sm text-[var(--onboard-muted)]">Step {step + 1} of {STEPS.length}</div>
        </div>

        <div className="flex gap-2 mb-8">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= step ? 'bg-[var(--onboard-accent)]' : 'bg-[var(--onboard-border)]'
              }`}
            />
          ))}
        </div>

        <div className="bg-[var(--onboard-card)] border border-[var(--onboard-border)] rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] animate-slide-up" key={step}>
          <p className="text-[var(--onboard-muted)] text-base mb-6">{stepData.subtitle}</p>

          {stepData?.id === 'intent' && (
            <div className="space-y-4">
              <button
                type="button"
                className={intentButton(formData.looking_for_friends)}
                onClick={() => setFormData(prev => ({ ...prev, looking_for_friends: !prev.looking_for_friends }))}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-[var(--onboard-ink)]">Friends</p>
                    <p className="text-sm text-[var(--onboard-muted)]">Find travel buddies and meetups.</p>
                  </div>
                  <span className={`h-5 w-5 rounded-full border ${formData.looking_for_friends ? 'bg-[var(--onboard-accent)] border-[var(--onboard-accent)]' : 'border-[var(--onboard-border)]'}`} />
                </div>
              </button>

              <button
                type="button"
                className={intentButton(formData.looking_for_dating)}
                onClick={() => setFormData(prev => ({ ...prev, looking_for_dating: !prev.looking_for_dating }))}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-[var(--onboard-ink)]">Dating</p>
                    <p className="text-sm text-[var(--onboard-muted)]">Romantic connections on the road.</p>
                  </div>
                  <span className={`h-5 w-5 rounded-full border ${formData.looking_for_dating ? 'bg-[var(--onboard-accent)] border-[var(--onboard-accent)]' : 'border-[var(--onboard-border)]'}`} />
                </div>
              </button>

              {/* Gender preference selection - only shown when Dating is selected */}
              {formData.looking_for_dating && (
                <div className="mt-6 pt-6 border-t border-[var(--onboard-border)]">
                  <p className="text-sm text-[var(--onboard-muted)] mb-3">Interested in</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, interested_in_men: !prev.interested_in_men }))}
                      className={`px-4 py-2 rounded-full border transition-colors ${
                        formData.interested_in_men
                          ? 'border-[var(--onboard-accent)] bg-[rgba(244,162,97,0.12)] text-[var(--onboard-ink)]'
                          : 'border-[var(--onboard-border)] text-[var(--onboard-muted)] hover:border-[var(--onboard-accent)]'
                      }`}
                    >
                      Men
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, interested_in_women: !prev.interested_in_women }))}
                      className={`px-4 py-2 rounded-full border transition-colors ${
                        formData.interested_in_women
                          ? 'border-[var(--onboard-accent)] bg-[rgba(244,162,97,0.12)] text-[var(--onboard-ink)]'
                          : 'border-[var(--onboard-border)] text-[var(--onboard-muted)] hover:border-[var(--onboard-accent)]'
                      }`}
                    >
                      Women
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, interested_in_nonbinary: !prev.interested_in_nonbinary }))}
                      className={`px-4 py-2 rounded-full border transition-colors ${
                        formData.interested_in_nonbinary
                          ? 'border-[var(--onboard-accent)] bg-[rgba(244,162,97,0.12)] text-[var(--onboard-ink)]'
                          : 'border-[var(--onboard-border)] text-[var(--onboard-muted)] hover:border-[var(--onboard-accent)]'
                      }`}
                    >
                      Non-binary
                    </button>
                  </div>
                  <p className="text-xs text-[var(--onboard-muted)] mt-2">Select one or more</p>
                </div>
              )}
            </div>
          )}

          {stepData?.id === 'basics' && (
            <div className="space-y-5">
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Gender</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {GENDER_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`px-4 py-2 rounded-full border transition-colors ${
                        formData.gender === option.value
                          ? 'border-[var(--onboard-accent)] bg-[rgba(244,162,97,0.12)] text-[var(--onboard-ink)]'
                          : 'border-[var(--onboard-border)] text-[var(--onboard-muted)] hover:border-[var(--onboard-accent)]'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, gender: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Display name</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] focus:border-[var(--onboard-accent)] focus:outline-none"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="How should people call you?"
                  maxLength={50}
                />
                <div className="text-xs text-[var(--onboard-muted)] mt-1">{formData.display_name.length}/50</div>
              </div>
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Bio</label>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] focus:border-[var(--onboard-accent)] focus:outline-none min-h-[120px]"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="One line about your travel style and what you are into."
                  maxLength={500}
                />
                <div className="text-xs text-[var(--onboard-muted)] mt-1">{formData.bio.length}/500</div>
              </div>
            </div>
          )}

          {stepData?.id === 'photo' && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl border border-[var(--onboard-border)] bg-black/40 flex items-center justify-center overflow-hidden">
                  {formData.avatar_url && !photoError ? (
                    <img
                      src={formData.avatar_url}
                      alt="Profile preview"
                      className="h-full w-full object-cover"
                      onError={() => setPhotoError(true)}
                    />
                  ) : (
                    <span className="text-lg text-[var(--onboard-muted)]">
                      {formData.display_name ? formData.display_name.charAt(0).toUpperCase() : 'V'}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm text-[var(--onboard-muted)]">Photo preview</p>
                  <p className="text-base font-medium text-[var(--onboard-ink)]">Add a URL to your favorite photo.</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Photo URL</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] focus:border-[var(--onboard-accent)] focus:outline-none"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, avatar_url: e.target.value }))}
                  placeholder="https://"
                  maxLength={500}
                />
                <p className="text-xs text-[var(--onboard-muted)] mt-2">You can add more photos later from your profile.</p>
              </div>
            </div>
          )}

          {stepData?.id === 'prefs' && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-[var(--onboard-muted)] mb-3">Profile type</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {PROFILE_TYPE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={optionButton(formData.profile_type === option.value)}
                      onClick={() => setFormData(prev => ({ ...prev, profile_type: option.value }))}
                    >
                      <p className="font-semibold text-[var(--onboard-ink)]">{option.label}</p>
                      <p className="text-xs text-[var(--onboard-muted)] mt-1">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-[var(--onboard-muted)] mb-3">Travel pace</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {TRAVEL_PACE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={optionButton(formData.travel_pace === option.value)}
                      onClick={() => setFormData(prev => ({ ...prev, travel_pace: option.value }))}
                    >
                      <p className="font-semibold text-[var(--onboard-ink)]">{option.label}</p>
                      <p className="text-xs text-[var(--onboard-muted)] mt-1">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3">
                <div>
                  <p className="font-semibold text-[var(--onboard-ink)]">Traveling with pets</p>
                  <p className="text-xs text-[var(--onboard-muted)]">Let others know if pets might join.</p>
                </div>
                <button
                  type="button"
                  className={`h-7 w-12 rounded-full border transition-colors ${
                    formData.has_pets
                      ? 'bg-[var(--onboard-accent)] border-[var(--onboard-accent)]'
                      : 'bg-black/40 border-[var(--onboard-border)]'
                  }`}
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    has_pets: !prev.has_pets,
                    pet_type: !prev.has_pets ? prev.pet_type : '',
                  }))}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                      formData.has_pets ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {formData.has_pets && (
                <div className="rounded-2xl border border-[var(--onboard-border)] bg-black/30 p-4">
                  <p className="text-sm font-semibold text-[var(--onboard-ink)]">What kind of pet?</p>
                  <p className="text-xs text-[var(--onboard-muted)] mt-1">Choose one so we can tailor matches.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PET_TYPE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                          formData.pet_type === option.value
                            ? 'border-[var(--onboard-accent)] bg-[rgba(244,162,97,0.18)] text-[var(--onboard-ink)]'
                            : 'border-[var(--onboard-border)] text-[var(--onboard-muted)] hover:border-[var(--onboard-accent)]'
                        }`}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          pet_type: prev.pet_type === option.value ? '' : option.value,
                        }))}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {stepData?.id === 'polish' && (
            <div className="space-y-6">
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Prompt 1</label>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] focus:border-[var(--onboard-accent)] focus:outline-none"
                  value={formData.prompt_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt_name: e.target.value }))}
                >
                  <option value="">Choose a prompt</option>
                  {travelPrompts
                    .filter(prompt => prompt.prompt_name !== formData.prompt_name_2)
                    .map(prompt => (
                      <option key={prompt.prompt_name} value={prompt.prompt_name}>
                        {prompt.prompt_question}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Your answer</label>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] focus:border-[var(--onboard-accent)] focus:outline-none min-h-[120px]"
                  value={formData.prompt_answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt_answer: e.target.value }))}
                  placeholder={promptOnePlaceholder}
                  maxLength={200}
                />
                <div className="text-xs text-[var(--onboard-muted)] mt-1">{formData.prompt_answer.length}/200</div>
              </div>

              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Prompt 2</label>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] focus:border-[var(--onboard-accent)] focus:outline-none"
                  value={formData.prompt_name_2}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt_name_2: e.target.value }))}
                >
                  <option value="">Choose a prompt</option>
                  {relationshipPrompts
                    .filter(prompt => prompt.prompt_name !== formData.prompt_name)
                    .map(prompt => (
                      <option key={prompt.prompt_name} value={prompt.prompt_name}>
                        {prompt.prompt_question}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Your answer</label>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] focus:border-[var(--onboard-accent)] focus:outline-none min-h-[120px]"
                  value={formData.prompt_answer_2}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt_answer_2: e.target.value }))}
                  placeholder={promptTwoPlaceholder}
                  maxLength={200}
                />
                <div className="text-xs text-[var(--onboard-muted)] mt-1">{formData.prompt_answer_2.length}/200</div>
              </div>

              <div className="rounded-2xl border border-[var(--onboard-border)] bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--onboard-muted)] mb-3">Preview</p>
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl border border-[var(--onboard-border)] bg-black/40 flex items-center justify-center overflow-hidden">
                    {formData.avatar_url && !photoError ? (
                      <img
                        src={formData.avatar_url}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={() => setPhotoError(true)}
                      />
                    ) : (
                      <span className="text-base text-[var(--onboard-muted)]">
                        {formData.display_name ? formData.display_name.charAt(0).toUpperCase() : 'V'}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[var(--onboard-ink)]">
                      {formData.display_name || 'Your name'}
                    </p>
                    <p className="text-sm text-[var(--onboard-muted)]">
                      {formData.bio || 'Add a short bio to help people connect.'}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-[var(--onboard-muted)]">
                      {formData.looking_for_dating && <span className="px-2 py-1 rounded-full border border-[var(--onboard-border)]">Dating</span>}
                      {formData.looking_for_friends && <span className="px-2 py-1 rounded-full border border-[var(--onboard-border)]">Friends</span>}
                      {formData.travel_pace && <span className="px-2 py-1 rounded-full border border-[var(--onboard-border)]">{formData.travel_pace}</span>}
                      {formData.profile_type && <span className="px-2 py-1 rounded-full border border-[var(--onboard-border)]">{formData.profile_type}</span>}
                      {formData.now_in_city && <span className="px-2 py-1 rounded-full border border-[var(--onboard-border)]">{formData.now_in_city}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {stepData?.id === 'location' && (
            <div className="space-y-5">
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Where are you right now?</label>
                <div className="mt-2">
                  <CityAutocomplete
                    value={formData.now_in_city}
                    onChange={(e) => setFormData(prev => ({ ...prev, now_in_city: e.target.value }))}
                    placeholder="e.g., Austin, TX"
                    name="now_in_city"
                    inputClassName="w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] placeholder-[var(--onboard-muted)] focus:border-[var(--onboard-accent)] focus:outline-none"
                    dropdownClassName="absolute z-50 w-full mt-1 bg-[#1a1816] border border-[var(--onboard-border)] rounded-2xl shadow-lg max-h-60 overflow-y-auto"
                    itemClassName="px-4 py-2 cursor-pointer transition-colors text-[var(--onboard-muted)] hover:bg-[var(--onboard-border)] hover:text-[var(--onboard-ink)]"
                  />
                </div>
                <p className="text-xs text-[var(--onboard-muted)] mt-2">We use this to show nearby people and plans.</p>
              </div>
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Next week (optional)</label>
                <div className="mt-2">
                  <CityAutocomplete
                    value={formData.next_week_in_city}
                    onChange={(e) => setFormData(prev => ({ ...prev, next_week_in_city: e.target.value }))}
                    placeholder="e.g., Flagstaff, AZ"
                    name="next_week_in_city"
                    inputClassName="w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] placeholder-[var(--onboard-muted)] focus:border-[var(--onboard-accent)] focus:outline-none"
                    dropdownClassName="absolute z-50 w-full mt-1 bg-[#1a1816] border border-[var(--onboard-border)] rounded-2xl shadow-lg max-h-60 overflow-y-auto"
                    itemClassName="px-4 py-2 cursor-pointer transition-colors text-[var(--onboard-muted)] hover:bg-[var(--onboard-border)] hover:text-[var(--onboard-ink)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--onboard-muted)]">Next month (optional)</label>
                <div className="mt-2">
                  <CityAutocomplete
                    value={formData.next_month_in_city}
                    onChange={(e) => setFormData(prev => ({ ...prev, next_month_in_city: e.target.value }))}
                    placeholder="e.g., San Diego, CA"
                    name="next_month_in_city"
                    inputClassName="w-full rounded-2xl border border-[var(--onboard-border)] bg-black/30 px-4 py-3 text-[var(--onboard-ink)] placeholder-[var(--onboard-muted)] focus:border-[var(--onboard-accent)] focus:outline-none"
                    dropdownClassName="absolute z-50 w-full mt-1 bg-[#1a1816] border border-[var(--onboard-border)] rounded-2xl shadow-lg max-h-60 overflow-y-auto"
                    itemClassName="px-4 py-2 cursor-pointer transition-colors text-[var(--onboard-muted)] hover:bg-[var(--onboard-border)] hover:text-[var(--onboard-ink)]"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0}
              className="rounded-full border border-[var(--onboard-border)] px-5 py-2 text-sm text-[var(--onboard-muted)] hover:text-[var(--onboard-ink)] hover:border-[var(--onboard-accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back
            </button>

            <div className="flex gap-3">
              {!isLastStep && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canContinue}
                  className="rounded-full bg-[var(--onboard-accent)] px-6 py-2 text-sm font-semibold text-black hover:bg-[var(--onboard-accent-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              )}
              {isLastStep && (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="rounded-full bg-[var(--onboard-accent)] px-6 py-2 text-sm font-semibold text-black hover:bg-[var(--onboard-accent-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Start swiping'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingPage;
