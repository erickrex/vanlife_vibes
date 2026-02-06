import React, { useState, useEffect } from 'react';
import { groupsAPI } from '../services/api';
import MyGroupsTab from '../components/MyGroupsTab';
import JoinTab from '../components/JoinTab';
import CreateGroupForm from '../components/CreateGroupForm';
import { Tabs, Tab } from '../components/Tabs';

function GroupsPage() {
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await groupsAPI.listMyInvitations();
        const invitations = response.data.data || response.data.results || response.data;
        const pending = Array.isArray(invitations) 
          ? invitations.filter(inv => inv.status === 'pending').length 
          : 0;
        setPendingInvitationsCount(pending);
      } catch (err) {
        console.error('Failed to fetch pending invitations:', err);
      }
    };
    
    fetchPendingCount();
  }, []);
  
  const handleCreateGroup = async (groupData) => {
    try {
      await groupsAPI.create(groupData);
    } catch (err) {
      throw new Error(err.message || 'Failed to create group');
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Groups</h1>
        </div>

        <Tabs defaultTab={pendingInvitationsCount > 0 ? 1 : 0}>
          <Tab label="My Groups">
            <MyGroupsTab />
          </Tab>
          <Tab label="Join" badge={pendingInvitationsCount}>
            <JoinTab />
          </Tab>
          <Tab label="Create">
            <div className="mt-4">
              <CreateGroupForm 
                onSubmit={handleCreateGroup}
              />
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}

export default GroupsPage;
