import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { plansAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PlanChat from '../components/PlanChat';
import { PLAN_TYPES, normalizePlan } from '../utils/plans';
import { DEFAULT_AVATAR } from '../utils/constants';

const TIME_WINDOWS = {
  morning: { label: 'Morning', time: '6am-12pm' },
  afternoon: { label: 'Afternoon', time: '12pm-5pm' },
  evening: { label: 'Evening', time: '5pm-9pm' },
  flexible: { label: 'Flexible', time: 'Any time' },
};

const ATTENDEE_STATUS = {
  joined: { label: 'Joined', color: 'text-blue-400' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-400' },
  declined: { label: 'Declined', color: 'text-red-400' },
};

function PlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await plansAPI.get(planId);
      setPlan(normalizePlan(response.data.data || response.data));
    } catch (err) {
      setError(err.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const getUserAttendance = () => {
    if (!plan || !user) return null;
    const userProfileId = user.profile_id || user.id;
    return plan.attendees?.find((attendee) => {
      const attendeeUserId = attendee?.user?.id || attendee?.user_id || attendee?.user;
      return attendeeUserId === userProfileId;
    });
  };

  const userAttendance = getUserAttendance();
  const isCreator = plan?.created_by?.id === (user?.profile_id || user?.id);
  const isAttending = !!userAttendance;
  const isConfirmed = userAttendance?.status === 'confirmed';
  const isFull = plan?.status === 'full' || (plan?.attendee_count >= plan?.max_attendees);

  const handleJoin = async () => {
    try { setActionLoading(true); await plansAPI.join(planId); await loadPlan(); }
    catch (err) { setError(err.message || 'Failed to join plan'); }
    finally { setActionLoading(false); }
  };

  const handleLeave = async () => {
    try { setActionLoading(true); await plansAPI.leave(planId); await loadPlan(); }
    catch (err) { setError(err.message || 'Failed to leave plan'); }
    finally { setActionLoading(false); }
  };

  const handleConfirm = async () => {
    try { setActionLoading(true); await plansAPI.confirm(planId); await loadPlan(); }
    catch (err) { setError(err.message || 'Failed to confirm attendance'); }
    finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this plan?')) return;
    try { setActionLoading(true); await plansAPI.cancel(planId); navigate('/plans'); }
    catch (err) { setError(err.message || 'Failed to cancel plan'); setActionLoading(false); }
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const getPlanTypeInfo = (type) => PLAN_TYPES[type] || { label: type };
  const getTimeWindowInfo = (window) => TIME_WINDOWS[window] || { label: window, time: '' };
  const getAttendeeStatusInfo = (status) => ATTENDEE_STATUS[status] || { label: status, color: 'text-zinc-400' };

  if (loading) {
    return (
      <div className="app-shell pb-20">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500">Loading plan...</p>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="app-shell pb-20">
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={loadPlan} className="app-btn-primary-social px-4 py-2 mb-2">
            Try Again
          </button>
          <Link to="/plans" className="text-blue-500 hover:underline">Back to Plans</Link>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const typeInfo = getPlanTypeInfo(plan.plan_type);
  const timeInfo = getTimeWindowInfo(plan.time_window);
  const attendeeCount = plan.attendee_count || 0;

  return (
    <div className="app-shell pb-20">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="py-4 flex items-center justify-between">
          <Link to="/plans" className="text-blue-500 text-sm hover:underline">← Back to Plans</Link>
          {isCreator && (
            <button onClick={handleCancel} disabled={actionLoading}
              className="text-red-400 text-sm hover:text-red-300 disabled:opacity-50">
              Cancel Plan
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Plan Info */}
        <div className="app-card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
              {typeInfo.label}
            </span>
            {plan.status === 'full' && <span className="px-2 py-1 bg-zinc-800 text-zinc-500 rounded text-xs">Full</span>}
            {plan.status === 'cancelled' && <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Cancelled</span>}
          </div>

          <h1 className="text-xl font-bold text-white mb-4">{plan.title}</h1>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-500 text-xs block mb-1">📅 Date</span>
              <span className="text-white text-sm">{formatDate(plan.plan_date)}</span>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-500 text-xs block mb-1">🕐 Time</span>
              <span className="text-white text-sm">{timeInfo.label} ({timeInfo.time})</span>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-500 text-xs block mb-1">📍 Meetup Area</span>
              <span className="text-white text-sm">{plan.meetup_area}</span>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg">
              <span className="text-zinc-500 text-xs block mb-1">👥 Attendees</span>
              <span className="text-white text-sm">{attendeeCount}/{plan.max_attendees}</span>
            </div>
          </div>

          {plan.description && (
            <div className="mb-4">
              <h3 className="text-white text-sm font-medium mb-2">About this plan</h3>
              <p className="text-zinc-400 text-sm">{plan.description}</p>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <span className="text-zinc-500 text-sm">Organized by</span>
            <Link to={`/profile/${plan.created_by?.id}`} className="flex items-center gap-2 hover:opacity-80">
              <img src={plan.created_by?.avatar_url || DEFAULT_AVATAR} alt="" className="w-6 h-6 rounded-full object-cover" />
              <span className="text-blue-400 text-sm">{plan.created_by?.display_name || 'Anonymous'}</span>
            </Link>
          </div>

          {/* Safety Note */}
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 text-xs">
              <span className="font-medium">💡 Safety tip:</span> Meet in public places for first meetups. Share your plans with a friend!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 space-y-2">
            {!isAttending && !isFull && plan.status !== 'cancelled' && (
              <button onClick={handleJoin} disabled={actionLoading}
                className="app-btn-primary-social w-full py-3 disabled:opacity-50">
                {actionLoading ? 'Joining...' : '✓ Join Plan'}
              </button>
            )}
            
            {!isAttending && isFull && (
              <button className="w-full py-3 bg-zinc-800 text-zinc-500 font-semibold rounded-lg" disabled>
                Plan is Full
              </button>
            )}

            {isAttending && !isConfirmed && (
              <>
                <button onClick={handleConfirm} disabled={actionLoading}
                  className="app-btn-primary-activity w-full py-3 disabled:opacity-50">
                  {actionLoading ? 'Confirming...' : '✓ Confirm Attendance'}
                </button>
                <button onClick={handleLeave} disabled={actionLoading}
                  className="app-btn-secondary w-full py-3 disabled:opacity-50">
                  {actionLoading ? 'Leaving...' : 'Leave Plan'}
                </button>
              </>
            )}

            {isAttending && isConfirmed && (
              <>
                <div className="py-3 bg-emerald-500/20 text-emerald-400 font-semibold rounded-lg text-center">
                  ✓ You're confirmed!
                </div>
                <button onClick={handleLeave} disabled={actionLoading}
                  className="app-btn-secondary w-full py-3 disabled:opacity-50">
                  {actionLoading ? 'Leaving...' : 'Leave Plan'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Attendees */}
        <div className="app-card p-4 mb-4">
          <h2 className="text-lg font-semibold text-white mb-4">Attendees ({attendeeCount}/{plan.max_attendees})</h2>
          
          {plan.attendees?.length > 0 ? (
            <div className="space-y-2">
              {plan.attendees.map((attendee) => {
                const statusInfo = getAttendeeStatusInfo(attendee.status);
                const attendeeUser =
                  attendee.user && typeof attendee.user === 'object'
                    ? attendee.user
                    : {};
                return (
                  <Link to={`/profile/${attendeeUser.id}`} key={attendee.id}
                    className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
                    <img src={attendeeUser.avatar_url || DEFAULT_AVATAR} alt="" className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1">
                      <span className="text-white font-medium block">{attendeeUser.display_name || 'Anonymous'}</span>
                      <span className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-4">No attendees yet. Be the first to join!</p>
          )}
        </div>

        {/* Chat */}
        {isAttending ? (
          <div className="app-card p-4">
            <h2 className="text-lg font-semibold text-white mb-4">💬 Group Chat</h2>
            <PlanChat planId={planId} />
          </div>
        ) : (
          <div className="app-card p-6 text-center">
            <span className="text-2xl block mb-2">🔒</span>
            <p className="text-zinc-500 text-sm">Join this plan to access the group chat</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlanDetailPage;
