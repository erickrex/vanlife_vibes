import React, { useState, useEffect } from 'react';
import { groupsAPI } from '../services/api';
import JoinRequestForm from './JoinRequestForm';
import InviteUserForm from './InviteUserForm';
import MyJoinRequestsList from './MyJoinRequestsList';
import MyInvitationsList from './MyInvitationsList';
import Toast from './Toast';
import SkeletonLoader from './SkeletonLoader';

function JoinTab() {
  const [myRequests, setMyRequests] = useState([]);
  const [myInvitations, setMyInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [requestsResponse, invitationsResponse] = await Promise.all([
        groupsAPI.listMyRequests(),
        groupsAPI.listMyInvitations(),
      ]);
      
      // Handle different response formats
      const requestsData = requestsResponse.data.data || requestsResponse.data.results || requestsResponse.data;
      const invitationsData = invitationsResponse.data.data || invitationsResponse.data.results || invitationsResponse.data;
      
      setMyRequests(Array.isArray(requestsData) ? requestsData : []);
      setMyInvitations(Array.isArray(invitationsData) ? invitationsData : []);
    } catch (err) {
      showToast(err.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleJoinRequest = async (groupName) => {
    await groupsAPI.createJoinRequest(groupName);
    await loadData();
  };

  const handleResendRequest = async (requestId) => {
    await groupsAPI.manageMyRequest(requestId, 'resend');
    await loadData();
  };

  const handleDeleteRequest = async (requestId) => {
    await groupsAPI.manageMyRequest(requestId, 'delete');
    await loadData();
  };

  const handleAcceptInvitation = async (invitationId) => {
    await groupsAPI.manageMyInvitation(invitationId, 'accept');
    await loadData();
  };

  const handleRejectInvitation = async (invitationId) => {
    await groupsAPI.manageMyInvitation(invitationId, 'reject');
    await loadData();
  };

  return (
    <div className="w-full flex flex-col gap-8 md:gap-12">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <section>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Send Invitation</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Invite users to join your groups
        </p>
        <InviteUserForm
          onSuccess={showToast}
          onError={(msg) => showToast(msg, 'error')}
        />
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Request to Join a Group</h2>
        <JoinRequestForm
          onSubmit={handleJoinRequest}
          onSuccess={showToast}
          onError={(msg) => showToast(msg, 'error')}
        />
        
        {loading ? (
          <>
            <h3 className="text-xl md:text-2xl font-semibold text-zinc-200 mt-8 mb-4">My Join Requests</h3>
            <SkeletonLoader type="card" count={2} />
          </>
        ) : myRequests.length > 0 ? (
          <>
            <h3 className="text-xl md:text-2xl font-semibold text-zinc-200 mt-8 mb-4">My Join Requests</h3>
            <MyJoinRequestsList
              requests={myRequests}
              onResend={handleResendRequest}
              onDelete={handleDeleteRequest}
              onSuccess={showToast}
              onError={(msg) => showToast(msg, 'error')}
            />
          </>
        ) : null}
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Received Invitations</h2>
        {loading ? (
          <SkeletonLoader type="card" count={2} />
        ) : (
          <MyInvitationsList
            invitations={myInvitations}
            onAccept={handleAcceptInvitation}
            onReject={handleRejectInvitation}
            onSuccess={showToast}
            onError={(msg) => showToast(msg, 'error')}
          />
        )}
      </section>
    </div>
  );
}

export default JoinTab;
