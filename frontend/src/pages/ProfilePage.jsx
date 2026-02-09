import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { profilesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_AVATAR } from '../utils/constants';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1400&q=80';

const TRAVEL_STATUS_LABELS = {
  'full-time': 'Full-time road life',
  'part-time': 'Part-time nomad',
  weekender: 'Weekend traveler',
  aspiring: 'Aspiring vanlifer',
};

const TRAVEL_COMPANIONS_LABELS = {
  solo: 'Solo',
  couple: 'Couple',
  family: 'Family',
  with_pets: 'With pets',
};

const WORK_STATUS_LABELS = {
  remote_worker: 'Remote worker',
  retired: 'Retired',
  seasonal_worker: 'Seasonal worker',
  unemployed: 'Not working now',
  other: 'Other',
};

const TRAVEL_PACE_LABELS = {
  slow: 'Slow travel',
  mixed: 'Mixed pace',
  fast: 'Fast mover',
  moderate: 'Moderate pace',
};

const CAMPING_PREFERENCE_LABELS = {
  boondocking: 'Boondocking',
  campgrounds: 'Campgrounds',
  stealth_camping: 'Stealth camping',
  rv_parks: 'RV parks',
  friends_driveways: "Friends' driveways",
};

function ProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isOwnProfile = !id || (user && profile && user.id === profile.user_id);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const response = id ? await profilesAPI.getProfile(id) : await profilesAPI.getMyProfile();
        setProfile(response.data.data || response.data);
      } catch (err) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [id]);

  const photoGallery = useMemo(() => {
    const vehiclePhotos = profile?.vehicle?.photos || [];
    const vehicleUrls = vehiclePhotos.map((photo) => photo.url || photo.image_url).filter(Boolean);
    
    // Add profile gallery photos
    const galleryPhotos = profile?.gallery_photos || [];
    const galleryUrls = galleryPhotos.map((photo) => photo.url).filter(Boolean);
    
    return [...galleryUrls, ...vehicleUrls];
  }, [profile]);

  const quickFacts = useMemo(() => {
    if (!profile) return [];

    const facts = [];
    if (profile.travel_status) {
      facts.push({ label: 'Travel style', value: TRAVEL_STATUS_LABELS[profile.travel_status] || profile.travel_status });
    }
    if (profile.travel_companions) {
      facts.push({ label: 'Crew', value: TRAVEL_COMPANIONS_LABELS[profile.travel_companions] || profile.travel_companions });
    }
    if (profile.travel_pace) {
      facts.push({ label: 'Pace', value: TRAVEL_PACE_LABELS[profile.travel_pace] || profile.travel_pace });
    }
    if (profile.work_status) {
      facts.push({ label: 'Work mode', value: WORK_STATUS_LABELS[profile.work_status] || profile.work_status });
    }
    if (profile.social_vibe) {
      facts.push({ label: 'Social vibe', value: profile.social_vibe.replaceAll('_', ' ') });
    }
    if (profile.rig_status) {
      facts.push({ label: 'Rig', value: profile.rig_status.replaceAll('_', ' ') });
    }
    return facts.slice(0, 6);
  }, [profile]);

  const profileHighlights = useMemo(() => {
    if (!profile) return [];
    const highlights = [];
    if (profile.profile_type) highlights.push(profile.profile_type.replaceAll('_', ' '));
    if (profile.lifestyle_schedule) highlights.push(profile.lifestyle_schedule.replaceAll('_', ' '));
    if (profile.lifestyle_environment) highlights.push(profile.lifestyle_environment.replaceAll('_', ' '));
    if (profile.has_pets) highlights.push(profile.pet_type ? `${profile.pet_type} companion` : 'Pet companion');
    if (profile.current_location) highlights.push(`Based around ${profile.current_location}`);
    return highlights.slice(0, 5);
  }, [profile]);

  const profileStats = useMemo(() => ([
    { label: 'Photos', value: photoGallery.length || 0 },
    { label: 'Interests', value: profile?.hobbies?.length || 0 },
    { label: 'Prompts', value: profile?.prompts?.length || 0 },
  ]), [photoGallery.length, profile?.hobbies?.length, profile?.prompts?.length]);

  if (loading) {
    return (
      <div className="app-shell pb-20">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-zinc-500">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="app-shell pb-20">
        <div className="text-center py-12 px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/feed" className="text-blue-400 hover:underline">Back to Friends</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-24">
      <div className="max-w-3xl mx-auto">
        <section className="app-card overflow-hidden">
          <div className="relative h-48 sm:h-64">
            <img src={profile.cover || profile.cover_url || DEFAULT_COVER} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          </div>

          <div className="px-4 sm:px-6 pb-6 -mt-14 relative">
            <div className="flex items-end justify-between gap-4">
              <img
                src={profile.avatar || profile.avatar_url || DEFAULT_AVATAR}
                alt={profile.display_name || 'User'}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-zinc-950 object-cover shadow-xl"
              />
              {isOwnProfile && (
                <Link to="/profile/edit" className="app-btn-primary-social px-4 py-2 text-sm">
                  Edit Profile
                </Link>
              )}
            </div>

            <div className="mt-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{profile.display_name || 'Anonymous'}</h1>
              {profile.username && <p className="text-zinc-400 text-sm mt-1">@{profile.username}</p>}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {profileStats.map((stat) => (
                <div key={stat.label} className="rounded-xl bg-zinc-900/70 border border-zinc-800 px-3 py-2 text-center">
                  <p className="text-white font-semibold text-sm">{stat.value}</p>
                  <p className="text-zinc-500 text-[11px] uppercase tracking-wide">{stat.label}</p>
                </div>
              ))}
            </div>

            {(profile.looking_for_dating || profile.looking_for_friends) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.looking_for_dating && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Dating
                  </span>
                )}
                {profile.looking_for_friends && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Friends
                  </span>
                )}
              </div>
            )}

            {profile.bio && (
              <p className="mt-4 text-zinc-200 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
            )}

            {profileHighlights.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {profileHighlights.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 app-card p-4 sm:p-5">
          <h2 className="text-white font-semibold text-lg mb-3">Photo Highlights</h2>
          {photoGallery.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photoGallery.map((photoUrl, index) => (
                <img
                  key={`${photoUrl}-${index + 1}`}
                  src={photoUrl}
                  alt={`Profile gallery ${index + 1}`}
                  className={`w-full object-cover rounded-xl border border-zinc-800 ${
                    index === 0 ? 'col-span-2 sm:col-span-2 aspect-[16/11]' : 'aspect-square'
                  }`}
                />
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">No gallery photos yet.</p>
          )}
        </section>

        <section className="mt-4 app-card p-4 sm:p-5">
          <h2 className="text-white font-semibold text-lg mb-3">Quick Facts</h2>
          {quickFacts.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {quickFacts.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                  <p className="text-xs text-zinc-500">{fact.label}</p>
                  <p className="text-zinc-100 text-sm font-medium mt-1">{fact.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">No quick facts set yet.</p>
          )}
        </section>

        <section className="mt-4 app-card p-4 sm:p-5">
          <h2 className="text-white font-semibold text-lg mb-3">Locations</h2>
          <div className="space-y-2.5">
            {profile.now_in_city && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-zinc-100">
                <span className="text-emerald-300 font-medium mr-2">Now:</span>{profile.now_in_city}
              </div>
            )}
            {profile.next_week_in_city && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-zinc-100">
                <span className="text-amber-300 font-medium mr-2">Next Week:</span>{profile.next_week_in_city}
              </div>
            )}
            {profile.next_month_in_city && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-sm text-zinc-100">
                <span className="text-orange-300 font-medium mr-2">Next Month:</span>{profile.next_month_in_city}
              </div>
            )}
            {!profile.now_in_city && !profile.next_week_in_city && !profile.next_month_in_city && (
              <p className="text-zinc-500 text-sm">No location timeline set.</p>
            )}
          </div>
        </section>

        {profile?.hobbies?.length > 0 && (
          <section className="mt-4 app-card p-4 sm:p-5">
            <h2 className="text-white font-semibold text-lg mb-3">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {profile.hobbies.map((hobby) => (
                <span
                  key={hobby.id || hobby.slug || hobby.name}
                  className="px-3 py-1.5 rounded-full text-sm bg-blue-500/15 text-blue-300 border border-blue-500/30"
                >
                  {hobby.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {profile?.prompts?.length > 0 && (
          <section className="mt-4 app-card p-4 sm:p-5">
            <h2 className="text-white font-semibold text-lg mb-3">About Me</h2>
            <div className="space-y-3">
              {profile.prompts.map((prompt) => (
                <article key={prompt.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{prompt.prompt_question}</p>
                  <p className="text-zinc-100 mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                    {prompt.prompt_answer}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {profile?.has_van && (
          <section className="mt-4 app-card p-4 sm:p-5">
            <h2 className="text-white font-semibold text-lg mb-3">Rig & Camping</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {profile?.vehicle?.nickname && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                  <p className="text-xs text-zinc-500">Rig Name</p>
                  <p className="text-zinc-100 text-sm mt-1">{profile.vehicle.nickname}</p>
                </div>
              )}
              {profile?.vehicle?.make && profile?.vehicle?.model && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                  <p className="text-xs text-zinc-500">Vehicle</p>
                  <p className="text-zinc-100 text-sm mt-1">
                    {profile.vehicle.year ? `${profile.vehicle.year} ` : ''}{profile.vehicle.make} {profile.vehicle.model}
                  </p>
                </div>
              )}
            </div>

            {profile?.camping_preferences?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.camping_preferences.map((pref) => (
                  <span key={pref} className="px-2.5 py-1 rounded-md text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {CAMPING_PREFERENCE_LABELS[pref] || pref}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
