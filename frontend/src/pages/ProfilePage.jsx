import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { profilesAPI, friendsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Default placeholder images
const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';
const DEFAULT_COVER = 'https://via.placeholder.com/800x300/1e1e3f/6c5ce7?text=Cover+Photo';

// Display labels for enum values
const VEHICLE_TYPE_LABELS = {
  van: 'Van',
  rv: 'RV',
  truck_camper: 'Truck Camper',
  skoolie: 'Skoolie',
  trailer: 'Trailer',
  car_camper: 'Car Camper',
  other: 'Other',
};

const BUILD_STATUS_LABELS = {
  stock: 'Stock',
  partial: 'Partial Build',
  full: 'Full Build',
};

const TRAVEL_STATUS_LABELS = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  weekender: 'Weekender',
  aspiring: 'Aspiring',
};

const TRAVEL_COMPANIONS_LABELS = {
  solo: 'Solo',
  couple: 'Couple',
  family: 'Family',
  with_pets: 'With Pets',
};

const WORK_STATUS_LABELS = {
  remote_worker: 'Remote Worker',
  retired: 'Retired',
  seasonal_worker: 'Seasonal Worker',
  unemployed: 'Unemployed',
  other: 'Other',
};

const TRAVEL_PACE_LABELS = {
  slow: 'Slow Travel (weeks per spot)',
  moderate: 'Moderate (days per spot)',
  fast: 'Fast Mover (daily moves)',
};

const CAMPING_PREFERENCE_LABELS = {
  boondocking: 'Boondocking',
  campgrounds: 'Campgrounds',
  stealth_camping: 'Stealth Camping',
  rv_parks: 'RV Parks',
  friends_driveways: "Friend's Driveways",
};

function ProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followLoading, setFollowLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  // Determine if viewing own profile
  const isOwnProfile = !id || (user && profile && user.id === profile.user_id);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      let response;
      if (id) {
        response = await profilesAPI.getProfile(id);
      } else {
        response = await profilesAPI.getMyProfile();
      }
      
      const profileData = response.data.data || response.data;
      setProfile(profileData);
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile || followLoading) return;
    
    try {
      setFollowLoading(true);
      
      if (profile.is_following) {
        await profilesAPI.unfollowUser(profile.id);
        setProfile(prev => ({
          ...prev,
          is_following: false,
          follower_count: prev.follower_count - 1,
        }));
      } else {
        await profilesAPI.followUser(profile.id);
        setProfile(prev => ({
          ...prev,
          is_following: true,
          follower_count: prev.follower_count + 1,
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!profile || chatLoading) return;
    
    try {
      setChatLoading(true);
      const response = await profilesAPI.startChat(profile.id, {});
      const data = response.data.data || response.data;
      const matchId = data?.match?.id;
      if (matchId) {
        navigate('/matches', { state: { matchId } });
      } else {
        setError('Failed to start chat');
      }
    } catch (err) {
      setError(err.message || 'Failed to start chat');
    } finally {
      setChatLoading(false);
    }
  };

  // Friend action handlers
  const handleSendFriendRequest = async () => {
    if (!profile || friendActionLoading) return;
    
    try {
      setFriendActionLoading(true);
      setError('');
      await friendsAPI.sendFriendRequest(profile.id);
      setProfile(prev => ({
        ...prev,
        friend_status: 'request_sent',
      }));
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!profile || !profile.pending_request_id || friendActionLoading) return;
    
    try {
      setFriendActionLoading(true);
      setError('');
      const response = await friendsAPI.acceptFriendRequest(profile.pending_request_id);
      const data = response.data.data || response.data;
      setProfile(prev => ({
        ...prev,
        friend_status: 'friends',
        friendship_id: data.friendship_id || data.id,
        pending_request_id: null,
      }));
    } catch (err) {
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleDeclineFriendRequest = async () => {
    if (!profile || !profile.pending_request_id || friendActionLoading) return;
    
    try {
      setFriendActionLoading(true);
      setError('');
      await friendsAPI.declineFriendRequest(profile.pending_request_id);
      setProfile(prev => ({
        ...prev,
        friend_status: 'none',
        pending_request_id: null,
      }));
    } catch (err) {
      setError(err.message || 'Failed to decline friend request');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleMessageFriend = () => {
    if (!profile || !profile.friendship_id) return;
    navigate(`/friends/${profile.friendship_id}/chat`);
  };

  const formatLocation = (location, cityField) => {
    // Prefer city field (new simplified format)
    if (cityField) {
      return cityField;
    }
    // Fall back to region-based location (legacy)
    if (!location) return null;
    const regionName = location.region?.name || '';
    const countryName = location.country?.name || '';
    if (regionName && countryName) {
      return `${regionName}, ${countryName}`;
    }
    return regionName || countryName || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="text-zinc-500">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="text-center py-12 px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/" className="text-blue-500 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-lg mx-auto">
        {/* Cover Photo */}
        <div className="relative h-32 sm:h-48 bg-zinc-900 overflow-hidden">
          <img
            src={profile?.cover_url || DEFAULT_COVER}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Avatar and Actions */}
        <div className="relative px-4">
          <div className="absolute -top-12 left-4">
            <img
              src={profile?.avatar_url || DEFAULT_AVATAR}
              alt={profile?.display_name || 'User'}
              className="w-24 h-24 rounded-full border-4 border-black object-cover shadow-lg"
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end pt-3 gap-2 flex-wrap">
            {isOwnProfile ? (
              <Link
                to="/profile/edit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                Edit Profile
              </Link>
            ) : (
              <>
                {/* Friend Action Buttons based on friend_status */}
                {profile?.friend_status === 'none' && (
                  <button
                    onClick={handleSendFriendRequest}
                    disabled={friendActionLoading}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {friendActionLoading ? 'Sending...' : 'Add Friend'}
                  </button>
                )}
                
                {profile?.friend_status === 'request_sent' && (
                  <span className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg font-semibold text-sm border border-zinc-700 cursor-default">
                    Request Sent
                  </span>
                )}
                
                {profile?.friend_status === 'request_received' && (
                  <>
                    <button
                      onClick={handleAcceptFriendRequest}
                      disabled={friendActionLoading}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                    >
                      {friendActionLoading ? '...' : 'Accept'}
                    </button>
                    <button
                      onClick={handleDeclineFriendRequest}
                      disabled={friendActionLoading}
                      className="px-4 py-2 bg-zinc-800 hover:bg-red-500 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50 border border-zinc-700 hover:border-red-500"
                    >
                      {friendActionLoading ? '...' : 'Decline'}
                    </button>
                  </>
                )}
                
                {profile?.friend_status === 'friends' && (
                  <>
                    <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg font-semibold text-sm border border-emerald-500/30 cursor-default flex items-center gap-1">
                      <span>✓</span> Friends
                    </span>
                    <button
                      onClick={handleMessageFriend}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-all"
                    >
                      Message
                    </button>
                  </>
                )}
                
                {/* Follow button - always shown for non-own profiles */}
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 ${
                    profile?.is_following
                      ? 'bg-zinc-800 text-white border border-zinc-700 hover:bg-red-500 hover:border-red-500'
                      : 'bg-zinc-800 text-white border border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {followLoading ? '...' : profile?.is_following ? 'Following' : 'Follow'}
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Profile Info */}
        <div className="px-4 pt-2 pb-6">
          {/* Name and Username */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-white">
              {profile?.display_name || 'Anonymous'}
            </h1>
            {profile?.username && (
              <p className="text-zinc-500 text-sm">@{profile.username}</p>
            )}
          </div>
          
          {/* Bio */}
          {profile?.bio && (
            <p className="text-zinc-300 mb-4 whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}
          
          {/* Follow Stats */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-1">
              <span className="font-bold text-white">
                {profile?.following_count || 0}
              </span>
              <span className="text-zinc-500 text-sm">Following</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-white">
                {profile?.follower_count || 0}
              </span>
              <span className="text-zinc-500 text-sm">Followers</span>
            </div>
            {profile?.is_followed_by && !isOwnProfile && (
              <span className="text-xs text-blue-400 bg-zinc-800 px-2 py-1 rounded">
                Follows you
              </span>
            )}
          </div>
          
          {/* Interested In */}
          {(profile?.interested_in_dating || profile?.interested_in_friends) && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {profile.interested_in_dating && (
                <span className="px-3 py-1 bg-pink-500/20 text-pink-400 rounded-full text-xs font-medium">
                  💕 Dating
                </span>
              )}
              {profile.interested_in_friends && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                  👋 Friends
                </span>
              )}
            </div>
          )}
          
          {/* Location Timing Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              📍 Location
            </h2>
            <div className="space-y-2">
              {(profile?.now_in_city || profile?.now_in) && (
                <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg">
                  <span className="text-emerald-400 font-medium text-sm">Now:</span>
                  <span className="text-zinc-300">
                    {formatLocation(profile.now_in, profile.now_in_city)}
                  </span>
                </div>
              )}
              {(profile?.next_week_in_city || profile?.next_week_in) && (
                <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg">
                  <span className="text-yellow-400 font-medium text-sm">Next Week:</span>
                  <span className="text-zinc-300">
                    {profile.next_week_in_city === 'Open plans' 
                      ? '🗺️ Open plans (flexible)' 
                      : formatLocation(profile.next_week_in, profile.next_week_in_city)}
                  </span>
                </div>
              )}
              {(profile?.next_month_in_city || profile?.next_month_in) && (
                <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg">
                  <span className="text-orange-400 font-medium text-sm">Next Month:</span>
                  <span className="text-zinc-300">
                    {profile.next_month_in_city === 'Open plans' 
                      ? '🗺️ Open plans (flexible)' 
                      : formatLocation(profile.next_month_in, profile.next_month_in_city)}
                  </span>
                </div>
              )}
              {!profile?.now_in_city && !profile?.now_in && !profile?.next_week_in_city && !profile?.next_week_in && !profile?.next_month_in_city && !profile?.next_month_in && (
                <p className="text-zinc-500 text-sm italic">No location set</p>
              )}
            </div>
          </div>
          
          {/* Hobbies Section */}
          {profile?.hobbies && profile.hobbies.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                🎯 Hobbies
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.hobbies.map((hobby) => (
                  <span
                    key={hobby.id || hobby.slug}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium"
                  >
                    {hobby.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Lifestyle Tags Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              🏕️ Lifestyle
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {profile?.travel_status && (
                <div className="p-3 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-1">Travel Status</p>
                  <p className="text-zinc-300 font-medium">
                    {TRAVEL_STATUS_LABELS[profile.travel_status] || profile.travel_status}
                  </p>
                </div>
              )}
              {profile?.travel_companions && (
                <div className="p-3 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-1">Traveling</p>
                  <p className="text-zinc-300 font-medium">
                    {TRAVEL_COMPANIONS_LABELS[profile.travel_companions] || profile.travel_companions}
                  </p>
                </div>
              )}
              {profile?.work_status && (
                <div className="p-3 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-1">Work</p>
                  <p className="text-zinc-300 font-medium">
                    {WORK_STATUS_LABELS[profile.work_status] || profile.work_status}
                  </p>
                </div>
              )}
              {profile?.travel_pace && (
                <div className="p-3 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-1">Travel Pace</p>
                  <p className="text-zinc-300 font-medium">
                    {TRAVEL_PACE_LABELS[profile.travel_pace] || profile.travel_pace}
                  </p>
                </div>
              )}
            </div>
            
            {/* Camping Preferences */}
            {profile?.has_van && profile?.camping_preferences && profile.camping_preferences.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-zinc-500 mb-2">Camping Preferences</p>
                <div className="flex flex-wrap gap-2">
                  {profile.camping_preferences.map((pref) => (
                    <span
                      key={pref}
                      className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs"
                    >
                      {CAMPING_PREFERENCE_LABELS[pref] || pref}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Vehicle Section - Only shown if has_van is true */}
          {profile?.has_van && profile?.vehicle && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                🚐 My Rig
              </h2>
              <div className="bg-zinc-900 rounded-xl p-4">
                {/* Vehicle Name/Nickname */}
                {profile.vehicle.nickname && (
                  <h3 className="text-lg font-bold text-blue-400 mb-2">
                    "{profile.vehicle.nickname}"
                  </h3>
                )}
                
                {/* Vehicle Details */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {profile.vehicle.vehicle_type && (
                    <div>
                      <p className="text-xs text-zinc-500">Type</p>
                      <p className="text-zinc-300 font-medium">
                        {VEHICLE_TYPE_LABELS[profile.vehicle.vehicle_type] || profile.vehicle.vehicle_type}
                      </p>
                    </div>
                  )}
                  {profile.vehicle.year && (
                    <div>
                      <p className="text-xs text-zinc-500">Year</p>
                      <p className="text-zinc-300 font-medium">
                        {profile.vehicle.year}
                      </p>
                    </div>
                  )}
                  {profile.vehicle.make && (
                    <div>
                      <p className="text-xs text-zinc-500">Make</p>
                      <p className="text-zinc-300 font-medium">
                        {profile.vehicle.make}
                      </p>
                    </div>
                  )}
                  {profile.vehicle.model && (
                    <div>
                      <p className="text-xs text-zinc-500">Model</p>
                      <p className="text-zinc-300 font-medium">
                        {profile.vehicle.model}
                      </p>
                    </div>
                  )}
                  {profile.vehicle.build_status && (
                    <div className="col-span-2">
                      <p className="text-xs text-zinc-500">Build Status</p>
                      <p className="text-zinc-300 font-medium">
                        {BUILD_STATUS_LABELS[profile.vehicle.build_status] || profile.vehicle.build_status}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Vehicle Photos */}
                {profile.vehicle.photos && profile.vehicle.photos.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Photos</p>
                    <div className="grid grid-cols-3 gap-2">
                      {profile.vehicle.photos.map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.url || photo.image_url}
                          alt="Vehicle"
                          className="w-full h-20 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
