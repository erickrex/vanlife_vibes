import React, { useState, useEffect } from 'react';
import { groupsAPI } from '../services/api';
import GroupList from './GroupList';
import SkeletonLoader from './SkeletonLoader';

function MyGroupsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await groupsAPI.list();
      
      // Handle different response formats
      const groupsData = response.data.data || response.data.results || response.data;
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (err) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-2 md:py-4">
        <SkeletonLoader type="card" count={3} />
      </div>
    );
  }

  return (
    <div className="py-2 md:py-4">
      <div className="mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-semibold text-white mb-2">My Groups</h2>
        <p className="text-sm md:text-base text-zinc-300">
          Groups you've created or joined
        </p>
      </div>
      
      <GroupList 
        groups={groups} 
        loading={loading} 
        error={error} 
      />
    </div>
  );
}

export default MyGroupsTab;
