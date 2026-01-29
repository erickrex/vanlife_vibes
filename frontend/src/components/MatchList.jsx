import React, { useState, useEffect, useMemo } from 'react';
import { sessionsAPI } from '../services/api';
import MatchCard from './MatchCard';
import './MatchList.css';

function MatchList({
  sessionId,
  autoRefresh = false,
  refreshInterval = 5000,
  onSelectMatch,
  selectedMatchId,
  onMatchesChange,
}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'approval'
  const [filterMinApproval, setFilterMinApproval] = useState(0);

  useEffect(() => {
    loadMatches();
    
    // Set up auto-refresh if enabled
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        loadMatches(true); // Silent refresh
      }, refreshInterval);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [sessionId, autoRefresh, refreshInterval]);

  const loadMatches = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      
      const response = await sessionsAPI.listMatches(sessionId);
      // API returns { status: 'success', data: [...] } or { status: 'success', data: { results: [...] } }
      let data = response.data.data || response.data;
      if (data && data.results) {
        data = data.results;
      }
      setMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load matches');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const sortedMatches = useMemo(() => {
    const filtered = matches.filter((match) => {
      if (filterMinApproval <= 0) return true;
      const approvals = match.snapshot?.approvals || 0;
      const totalMembers = match.snapshot?.total_members || 0;

      const approvalPercentage = totalMembers > 0 
        ? (approvals / totalMembers) * 100 
        : 0;

      return approvalPercentage >= filterMinApproval;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.matched_at) - new Date(a.matched_at);
      }
      if (sortBy === 'approval') {
        const aApprovals = a.snapshot?.approvals || 0;
        const aTotal = a.snapshot?.total_members || 0;
        const bApprovals = b.snapshot?.approvals || 0;
        const bTotal = b.snapshot?.total_members || 0;
        const aPercentage = aTotal > 0 ? (aApprovals / aTotal) * 100 : 0;
        const bPercentage = bTotal > 0 ? (bApprovals / bTotal) * 100 : 0;
        return bPercentage - aPercentage;
      }
      return 0;
    });

    return sorted;
  }, [matches, sortBy, filterMinApproval]);

  const handleRefresh = () => {
    loadMatches();
  };

  useEffect(() => {
    if (onMatchesChange) {
      onMatchesChange(sortedMatches);
    }
  }, [sortedMatches, onMatchesChange]);

  if (loading) {
    return (
      <div className="match-list-loading">
        <div className="spinner"></div>
        <p>Loading matches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="match-list-error">
        <p>{error}</p>
        <button onClick={handleRefresh} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="match-list">
      <div className="match-list-controls">
        <div className="control-group">
          <label htmlFor="sort-by">Sort by:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="date">Most Recent</option>
            <option value="approval">Highest Approval</option>
          </select>
        </div>
        
        <div className="control-group">
          <label htmlFor="min-approval">Min Approval %:</label>
          <input
            id="min-approval"
            type="number"
            min="0"
            max="100"
            value={filterMinApproval}
            onChange={(e) => setFilterMinApproval(Number(e.target.value))}
            className="filter-input"
          />
        </div>
        
        <button onClick={handleRefresh} className="refresh-button" title="Refresh">
          ↻ Refresh
        </button>
      </div>

      {sortedMatches.length === 0 ? (
        <div className="match-list-empty">
          {matches.length === 0 ? (
            <>
              <p>No matches yet.</p>
              <p>VanlifeVibes will pin the top-approved options here.</p>
            </>
          ) : (
            <p>No matches match the current filter.</p>
          )}
        </div>
      ) : (
        <div className="match-grid">
          {sortedMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onSelect={onSelectMatch}
              isSelected={selectedMatchId === match.id}
            />
          ))}
        </div>
      )}
      
      {autoRefresh && (
        <div className="auto-refresh-indicator">
          <span className="refresh-dot"></span>
          Auto-refreshing every {refreshInterval / 1000}s
        </div>
      )}
    </div>
  );
}

export default MatchList;
