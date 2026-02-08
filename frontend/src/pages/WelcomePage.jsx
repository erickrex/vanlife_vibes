import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI, discoveryAPI, eventsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { buildCompatibilityChips } from '../utils/compatibility';

function getResponseList(response) {
  const data = response?.data?.data || response?.data || [];
  return Array.isArray(data) ? data : [];
}

function getPrimaryRoute(profile) {
  if (profile?.looking_for_dating) return '/dating';
  if (profile?.looking_for_friends) return '/discover?mode=friends';
  return '/feed';
}

function WelcomePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [people, setPeople] = useState([]);
  const [activity, setActivity] = useState(null);
  const [plan, setPlan] = useState(null);
  const hasTrackedViewRef = useRef(false);

  const primaryRoute = useMemo(() => getPrimaryRoute(profile), [profile]);

  const trackEvent = useCallback((eventName, metadata = {}) => {
    analyticsAPI.trackEvent(eventName, {
      page: 'welcome',
      ...metadata,
    }).catch(() => {
      // Intentionally ignore analytics failures so the core UX never blocks.
    });
  }, []);

  const loadRecommendations = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const requests = [];
      if (profile.looking_for_dating) requests.push(discoveryAPI.getDatingProfiles());
      if (profile.looking_for_friends) requests.push(discoveryAPI.getFriendsProfiles());
      // Fetch swipe-mode events (activities) and direct-mode events (plans)
      requests.push(eventsAPI.list({ join_mode: 'swipe' }));
      requests.push(eventsAPI.list({ join_mode: 'direct' }));

      const results = await Promise.allSettled(requests);
      let resultIndex = 0;

      const peopleCandidates = [];
      if (profile.looking_for_dating) {
        const datingResult = results[resultIndex++];
        if (datingResult.status === 'fulfilled') {
          getResponseList(datingResult.value).forEach((item) => {
            peopleCandidates.push({ ...item, mode: 'dating' });
          });
        }
      }
      if (profile.looking_for_friends) {
        const friendsResult = results[resultIndex++];
        if (friendsResult.status === 'fulfilled') {
          getResponseList(friendsResult.value).forEach((item) => {
            peopleCandidates.push({ ...item, mode: 'friends' });
          });
        }
      }

      const swipeEventsResult = results[resultIndex++];
      const directEventsResult = results[resultIndex++];

      const uniquePeople = [];
      const seenPeople = new Set();
      for (const candidate of peopleCandidates) {
        if (!seenPeople.has(candidate.id)) {
          seenPeople.add(candidate.id);
          uniquePeople.push(candidate);
        }
        if (uniquePeople.length === 3) break;
      }

      setPeople(uniquePeople);

      if (swipeEventsResult.status === 'fulfilled') {
        const swipeEvents = getResponseList(swipeEventsResult.value);
        setActivity(swipeEvents[0] || null);
      } else {
        setActivity(null);
      }

      if (directEventsResult.status === 'fulfilled') {
        const directEvents = getResponseList(directEventsResult.value);
        setPlan(directEvents[0] || null);
      } else {
        setPlan(null);
      }
    } catch (requestError) {
      setError(requestError.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  useEffect(() => {
    if (!profile?.id || hasTrackedViewRef.current) {
      return;
    }
    hasTrackedViewRef.current = true;
    trackEvent('welcome_viewed', {
      looking_for_dating: !!profile.looking_for_dating,
      looking_for_friends: !!profile.looking_for_friends,
    });
  }, [profile?.id, profile?.looking_for_dating, profile?.looking_for_friends, trackEvent]);

  const handleStartSwiping = () => {
    trackEvent('welcome_start_swiping', {
      destination: primaryRoute,
    });
    navigate(primaryRoute);
  };

  const handleOpenFeed = () => {
    trackEvent('welcome_open_feed');
    navigate('/feed');
  };

  const handlePersonClick = (person) => {
    trackEvent('welcome_person_click', {
      target_profile_id: person.id,
      mode: person.mode,
    });
    navigate(`/profile/${person.id}`);
  };

  const handleActivityClick = () => {
    if (!activity) return;
    trackEvent('welcome_activity_click', {
      activity_id: activity.id,
    });
    navigate(`/events/${activity.id}`);
  };

  const handlePlanClick = () => {
    if (!plan) return;
    trackEvent('welcome_plan_click', {
      plan_id: plan.id,
    });
    navigate(`/events/${plan.id}`);
  };

  const handleOpenPrimaryDiscovery = () => {
    trackEvent('welcome_people_empty_primary_click', {
      destination: primaryRoute,
    });
    navigate(primaryRoute);
  };

  const handleOpenMatches = () => {
    trackEvent('welcome_people_empty_matches_click');
    navigate('/matches');
  };

  const handleBrowseActivities = () => {
    trackEvent('welcome_activity_empty_browse_click');
    navigate('/events');
  };

  const handleCreateActivity = () => {
    trackEvent('welcome_activity_empty_create_click');
    navigate('/events/create');
  };

  const handleBrowsePlans = () => {
    trackEvent('welcome_plan_empty_browse_click');
    navigate('/events');
  };

  const handleCreatePlan = () => {
    trackEvent('welcome_plan_empty_create_click');
    navigate('/events/create');
  };

  const primaryDiscoveryLabel = useMemo(() => {
    if (primaryRoute.startsWith('/dating')) return 'Open Dating';
    if (primaryRoute.startsWith('/discover')) return 'Find Friends';
    return 'Open Feed';
  }, [primaryRoute]);

  if (loading) {
    return (
      <div className="app-shell">
        <div className="max-w-4xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="text-zinc-500">Preparing your first matches...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-12">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <header className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <p className="text-zinc-400 text-sm mb-2">Your first roadmap</p>
          <h1 className="text-2xl text-white font-semibold">You are ready to connect</h1>
          <p className="text-zinc-400 mt-2">
            Start with a few high-fit people, one activity, and one meetup plan.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              className="app-btn-primary-social px-4 py-2 text-sm font-medium"
              onClick={handleStartSwiping}
            >
              Start Swiping
            </button>
            <button
              type="button"
              className="app-btn-secondary px-4 py-2 text-sm font-medium"
              onClick={handleOpenFeed}
            >
              Open Feed
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-900/40 border border-red-800 rounded-xl p-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-4">Top People</h2>
          {people.length === 0 ? (
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <p className="text-zinc-300 text-sm">
                No profiles are available right now. Keep momentum by opening discovery or checking your matches.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="app-btn-primary-social px-4 py-2 text-sm font-medium"
                  onClick={handleOpenPrimaryDiscovery}
                >
                  {primaryDiscoveryLabel}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-zinc-600 hover:border-zinc-400 text-white rounded-lg text-sm font-medium"
                  onClick={handleOpenMatches}
                >
                  View Matches
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {people.map((person) => {
                const chips = buildCompatibilityChips(profile, person, 3);
                return (
                  <div key={person.id} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-white font-medium">{person.display_name || 'Anonymous'}</p>
                        <p className="text-zinc-400 text-xs">
                          {person.mode === 'dating' ? 'Dating' : 'Friends'}
                          {person.now_in_city ? ` | ${person.now_in_city}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePersonClick(person)}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        View Profile
                      </button>
                    </div>
                    {chips.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {chips.map((chip) => (
                          <span key={`${person.id}-${chip}`} className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs">
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-4">One Activity To Join</h2>
          {activity ? (
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <p className="text-white font-medium">{activity.title}</p>
              <p className="text-zinc-400 text-sm mt-1">
                {activity.event_date} | {activity.location}
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleActivityClick}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Open Activity
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <p className="text-zinc-300 text-sm">
                No open activities yet. Join one nearby or create your own.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="app-btn-primary-social px-4 py-2 text-sm font-medium"
                  onClick={handleBrowseActivities}
                >
                  Browse Events
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-zinc-600 hover:border-zinc-400 text-white rounded-lg text-sm font-medium"
                  onClick={handleCreateActivity}
                >
                  Create Event
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-4">One Plan Suggestion</h2>
          {plan ? (
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <p className="text-white font-medium">{plan.title}</p>
              <p className="text-zinc-400 text-sm mt-1">
                {plan.event_date} | {plan.location}
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handlePlanClick}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Open Plan
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <p className="text-zinc-300 text-sm">
                No open plans yet. Browse active meetup plans or start one.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="app-btn-primary-social px-4 py-2 text-sm font-medium"
                  onClick={handleBrowsePlans}
                >
                  Browse Events
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-zinc-600 hover:border-zinc-400 text-white rounded-lg text-sm font-medium"
                  onClick={handleCreatePlan}
                >
                  Create Event
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default WelcomePage;
