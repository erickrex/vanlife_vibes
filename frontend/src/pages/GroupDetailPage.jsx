import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { groupsAPI, sessionsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import GroupDetail from '../components/GroupDetail';
import SessionList from '../components/SessionList';
import InviteModal from '../components/InviteModal';
import JoinRequestsList from '../components/JoinRequestsList';
import RejectedInvitationsList from '../components/RejectedInvitationsList';
import RejectedRequestsList from '../components/RejectedRequestsList';
import Toast from '../components/Toast';
import SkeletonLoader from '../components/SkeletonLoader';

function GroupDetailPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [rejectedInvitations, setRejectedInvitations] = useState([]);
  const [rejectedRequests, setRejectedRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('sessions');
  const [loading, setLoading] = useState(true);
  const [adminDataLoading, setAdminDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    joinRequests: false,
    rejectedInvitations: false,
    rejectedRequests: false,
  });

  useEffect(() => {
    loadGroupData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredSessions(sessions);
    } else {
      setFilteredSessions(sessions.filter(session => session.status === statusFilter));
    }
  }, [sessions, statusFilter]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const promises = [
        groupsAPI.get(groupId),
        groupsAPI.listMembers(groupId),
        sessionsAPI.listByGroup(groupId),
      ];
      
      const [groupResponse, membersResponse, sessionsResponse] = await Promise.all(promises);
      
      const groupData = groupResponse.data.data || groupResponse.data;
      const membersData = membersResponse.data.data || membersResponse.data.results || membersResponse.data;
      const sessionsData = sessionsResponse.data.data || sessionsResponse.data.results || sessionsResponse.data;
      
      setGroup(groupData);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      
      const membersList = Array.isArray(membersData) ? membersData : [];
      const userMembership = membersList.find(m => m.user?.id === user?.id);
      if (userMembership && !userMembership.is_confirmed) {
        setPendingInvitations([userMembership]);
      }
      
      const isUserAdmin = membersList.find(m => m.user?.id === user?.id)?.role === 'admin';
      if (isUserAdmin) {
        await loadAdminData();
      }
    } catch (err) {
      setError(err.message || 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  };
  
  const loadAdminData = async () => {
    try {
      setAdminDataLoading(true);
      const [joinRequestsResponse, rejectedInvitationsResponse, rejectedRequestsResponse] = await Promise.all([
        groupsAPI.listGroupJoinRequests(groupId),
        groupsAPI.listRejectedInvitations(groupId),
        groupsAPI.listRejectedRequests(groupId),
      ]);
      
      const joinRequestsData = joinRequestsResponse.data.data || joinRequestsResponse.data.results || joinRequestsResponse.data;
      const rejectedInvitationsData = rejectedInvitationsResponse.data.data || rejectedInvitationsResponse.data.results || rejectedInvitationsResponse.data;
      const rejectedRequestsData = rejectedRequestsResponse.data.data || rejectedRequestsResponse.data.results || rejectedRequestsResponse.data;
      
      setJoinRequests(Array.isArray(joinRequestsData) ? joinRequestsData : []);
      setRejectedInvitations(Array.isArray(rejectedInvitationsData) ? rejectedInvitationsData : []);
      setRejectedRequests(Array.isArray(rejectedRequestsData) ? rejectedRequestsData : []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setAdminDataLoading(false);
    }
  };

  const handleInvite = async (username) => {
    try {
      await groupsAPI.inviteMember(groupId, { username });
      await loadGroupData();
      showSuccess('Invitation sent successfully');
    } catch (err) {
      throw new Error(err.message || 'Failed to send invitation');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) {
      return;
    }
    
    try {
      await groupsAPI.removeMember(groupId, userId);
      await loadGroupData();
    } catch (err) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const handleAcceptInvitation = async () => {
    try {
      await groupsAPI.updateMembership(groupId, user.id, { is_confirmed: true });
      await loadGroupData();
    } catch (err) {
      setError(err.message || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async () => {
    if (!window.confirm('Are you sure you want to decline this invitation?')) {
      return;
    }
    
    try {
      await groupsAPI.removeMember(groupId, user.id);
      window.location.href = '/groups';
    } catch (err) {
      setError(err.message || 'Failed to decline invitation');
    }
  };
  
  const handleApproveRequest = async (requestId) => {
    try {
      await groupsAPI.manageJoinRequest(groupId, requestId, 'approve');
      await loadGroupData();
    } catch (err) {
      throw err;
    }
  };
  
  const handleRejectRequest = async (requestId) => {
    try {
      await groupsAPI.manageJoinRequest(groupId, requestId, 'reject');
      await loadAdminData();
    } catch (err) {
      throw err;
    }
  };
  
  const handleResendInvitation = async (invitationId) => {
    try {
      await groupsAPI.manageRejectedInvitation(groupId, invitationId, 'resend');
      await loadAdminData();
    } catch (err) {
      throw err;
    }
  };
  
  const handleDeleteInvitation = async (invitationId) => {
    try {
      await groupsAPI.manageRejectedInvitation(groupId, invitationId, 'delete');
      await loadAdminData();
    } catch (err) {
      throw err;
    }
  };
  
  const handleDeleteRequest = async (requestId) => {
    try {
      await groupsAPI.manageRejectedRequest(groupId, requestId, 'delete');
      await loadAdminData();
    } catch (err) {
      throw err;
    }
  };
  
  const showSuccess = (message) => {
    setToast({ message, type: 'success' });
  };
  
  const showError = (message) => {
    setToast({ message, type: 'error' });
  };
  
  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-400 flex items-center justify-center p-4">
        Loading group...
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-black text-red-400 flex flex-col items-center justify-center p-4 gap-4">
        <p>{error}</p>
        <Link to="/groups" className="text-blue-500 hover:text-blue-400 font-medium">
          ← Back to Groups
        </Link>
      </div>
    );
  }

  const currentMembership = members.find(m => m.user?.id === user?.id);
  const isAdmin = currentMembership?.role === 'admin';

  return (
    <div className="min-h-screen bg-black px-4 pb-20 pt-4">
      <div className="max-w-4xl mx-auto">
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        <Link 
          to="/groups" 
          className="inline-block text-blue-500 hover:text-blue-400 font-medium mb-6 py-2"
        >
          ← Back to Groups
        </Link>

        {pendingInvitations.length > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4 rounded-xl mb-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm sm:text-base">
                You've been invited to join <span className="font-semibold">{group.name}</span>
              </p>
              <div className="flex gap-3">
                <button 
                  className="flex-1 sm:flex-none px-4 py-2 bg-zinc-900 text-blue-400 border border-blue-400 rounded-lg font-semibold text-sm hover:bg-zinc-800 transition-colors min-h-[44px]"
                  onClick={handleAcceptInvitation}
                >
                  Accept
                </button>
                <button 
                  className="flex-1 sm:flex-none px-4 py-2 bg-transparent text-white border-2 border-white rounded-lg font-semibold text-sm hover:bg-white/10 transition-colors min-h-[44px]"
                  onClick={handleDeclineInvitation}
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/15 text-red-400 p-4 rounded-lg mb-6 text-sm border border-red-500/50">
            {error}
          </div>
        )}

        <div className="flex gap-2 border-b-2 border-zinc-800 mb-6">
          <button
            className={`px-4 py-3 text-base font-semibold border-b-3 transition-colors min-h-[44px] ${
              activeTab === 'sessions'
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-zinc-400 border-b-2 border-transparent hover:text-white hover:bg-zinc-900'
            }`}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions ({sessions.length})
          </button>
          <button
            className={`px-4 py-3 text-base font-semibold border-b-3 transition-colors min-h-[44px] ${
              activeTab === 'members'
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-zinc-400 border-b-2 border-transparent hover:text-white hover:bg-zinc-900'
            }`}
            onClick={() => setActiveTab('members')}
          >
            Members ({members.filter(m => m.is_confirmed).length})
          </button>
        </div>

        <div className="min-h-[300px]">
          {activeTab === 'sessions' ? (
            <div>
              <div className="flex justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-white m-0">Sessions</h2>
                {isAdmin && (
                  <Link 
                    to={`/groups/${groupId}/sessions/new`} 
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-all hover:-translate-y-0.5 shadow-lg whitespace-nowrap min-h-[44px] flex items-center"
                  >
                    + New Session
                  </Link>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                <label htmlFor="status-filter" className="font-semibold text-zinc-300 text-sm">
                  Filter by status:
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-zinc-700 rounded-lg text-sm bg-zinc-800 text-white cursor-pointer focus:outline-none focus:border-zinc-500 min-h-[44px]"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              
              <SessionList
                sessions={filteredSessions}
                groupId={groupId}
                isAdmin={isAdmin}
              />
            </div>
          ) : (
            <div>
              <GroupDetail
                group={group}
                members={members}
                onInvite={() => setShowInviteModal(true)}
                onRemoveMember={handleRemoveMember}
                onApproveJoinRequest={handleApproveRequest}
                onRejectJoinRequest={handleRejectRequest}
                isAdmin={isAdmin}
              />
              
              {isAdmin && joinRequests.length > 0 && (
                <div className="mt-8 pt-8 border-t-2 border-zinc-800">
                  <div 
                    className="flex justify-between items-center mb-4 cursor-pointer select-none group"
                    onClick={() => !adminDataLoading && toggleSection('joinRequests')}
                  >
                    <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      Pending Join Requests ({joinRequests.length})
                    </h2>
                    {!adminDataLoading && (
                      <button 
                        className={`bg-transparent border-none text-2xl text-zinc-400 cursor-pointer p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-all hover:text-blue-400 ${
                          collapsedSections.joinRequests ? '-rotate-90' : ''
                        }`}
                        aria-label={collapsedSections.joinRequests ? 'Expand section' : 'Collapse section'}
                      >
                        ▼
                      </button>
                    )}
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${
                    collapsedSections.joinRequests ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
                  }`}>
                    {adminDataLoading ? (
                      <SkeletonLoader type="card" count={2} />
                    ) : (
                      <JoinRequestsList
                        requests={joinRequests}
                        onApprove={handleApproveRequest}
                        onReject={handleRejectRequest}
                        onSuccess={showSuccess}
                        onError={showError}
                      />
                    )}
                  </div>
                </div>
              )}
              
              {isAdmin && rejectedInvitations.length > 0 && (
                <div className="mt-8 pt-8 border-t-2 border-zinc-800">
                  <div 
                    className="flex justify-between items-center mb-4 cursor-pointer select-none group"
                    onClick={() => !adminDataLoading && toggleSection('rejectedInvitations')}
                  >
                    <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      Rejected Invitations
                    </h2>
                    {!adminDataLoading && (
                      <button 
                        className={`bg-transparent border-none text-2xl text-zinc-400 cursor-pointer p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-all hover:text-blue-400 ${
                          collapsedSections.rejectedInvitations ? '-rotate-90' : ''
                        }`}
                        aria-label={collapsedSections.rejectedInvitations ? 'Expand section' : 'Collapse section'}
                      >
                        ▼
                      </button>
                    )}
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${
                    collapsedSections.rejectedInvitations ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
                  }`}>
                    {adminDataLoading ? (
                      <SkeletonLoader type="card" count={2} />
                    ) : (
                      <RejectedInvitationsList
                        invitations={rejectedInvitations}
                        onResend={handleResendInvitation}
                        onDelete={handleDeleteInvitation}
                        onSuccess={showSuccess}
                        onError={showError}
                      />
                    )}
                  </div>
                </div>
              )}
              
              {isAdmin && rejectedRequests.length > 0 && (
                <div className="mt-8 pt-8 border-t-2 border-zinc-800">
                  <div 
                    className="flex justify-between items-center mb-4 cursor-pointer select-none group"
                    onClick={() => !adminDataLoading && toggleSection('rejectedRequests')}
                  >
                    <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      Rejected Requests
                    </h2>
                    {!adminDataLoading && (
                      <button 
                        className={`bg-transparent border-none text-2xl text-zinc-400 cursor-pointer p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-all hover:text-blue-400 ${
                          collapsedSections.rejectedRequests ? '-rotate-90' : ''
                        }`}
                        aria-label={collapsedSections.rejectedRequests ? 'Expand section' : 'Collapse section'}
                      >
                        ▼
                      </button>
                    )}
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${
                    collapsedSections.rejectedRequests ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
                  }`}>
                    {adminDataLoading ? (
                      <SkeletonLoader type="card" count={2} />
                    ) : (
                      <RejectedRequestsList
                        requests={rejectedRequests}
                        onDelete={handleDeleteRequest}
                        onSuccess={showSuccess}
                        onError={showError}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <InviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInvite}
          groupName={group?.name}
        />
      </div>
    </div>
  );
}

export default GroupDetailPage;
