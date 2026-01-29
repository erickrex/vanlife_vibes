import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CandidateList from '../components/CandidateList';
import AddCandidateForm from '../components/AddCandidateForm';
import CandidateFilter from '../components/CandidateFilter';
import Toast from '../components/Toast';
import { candidatesAPI, taxonomiesAPI, sessionsAPI, groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './CandidateManagementPage.css';

function CandidateManagementPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [session, setSession] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [taxonomies, setTaxonomies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [filters, setFilters] = useState({ tags: [], attributes: {} });
  const [toast, setToast] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, [sessionId]);

  useEffect(() => {
    if (!isLoading) {
      loadCandidates();
    }
  }, [filters]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load session details
      const sessionResponse = await sessionsAPI.get(sessionId);
      const sessionData = sessionResponse.data.data;
      setSession(sessionData);
      
      // Check if user is admin of the group
      try {
        const membersResponse = await groupsAPI.listMembers(sessionData.group);
        const members = membersResponse.data.data || [];
        const currentUserMembership = members.find(m => m.user?.id === user?.id);
        setIsAdmin(currentUserMembership?.role === 'admin');
      } catch (err) {
        console.error('Failed to check admin status:', err);
        setIsAdmin(false);
      }
      
      // Load taxonomies with terms
      const taxonomiesResponse = await taxonomiesAPI.list();
      const taxonomiesData = taxonomiesResponse.data.data || [];
      
      // Load terms for each taxonomy
      const taxonomiesWithTerms = await Promise.all(
        taxonomiesData.map(async (taxonomy) => {
          try {
            const termsResponse = await taxonomiesAPI.listTerms(taxonomy.id);
            return {
              ...taxonomy,
              terms: termsResponse.data.data || []
            };
          } catch (err) {
            console.error(`Failed to load terms for taxonomy ${taxonomy.id}:`, err);
            return {
              ...taxonomy,
              terms: []
            };
          }
        })
      );
      
      setTaxonomies(taxonomiesWithTerms);
      
      // Load candidates
      await loadCandidates();
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast('Failed to load data. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCandidates = async () => {
    try {
      const params = new URLSearchParams();
      
      // Add tag filters
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach((tagId) => {
          params.append('tag', tagId);
        });
      }
      
      // Add attribute filters
      if (filters.attributes && Object.keys(filters.attributes).length > 0) {
        Object.entries(filters.attributes).forEach(([key, value]) => {
          params.append(key, value);
        });
      }
      
      const response = await candidatesAPI.list(sessionId, params);
      setCandidates(response.data.data?.results || response.data.data || []);
    } catch (err) {
      console.error('Failed to load candidates:', err);
      showToast('Failed to load candidates. Please try again.', 'error');
    }
  };

  const handleAddCandidate = async (candidateData) => {
    try {
      const { tag_ids: tagIds = [], ...payload } = candidateData;
      const response = await candidatesAPI.create(sessionId, payload);
      const candidateId = response.data.data?.id || response.data.id;
      
      if (candidateId && tagIds.length > 0) {
        await Promise.all(
          tagIds.map((tagId) => candidatesAPI.tagCandidate(candidateId, tagId))
        );
      }

      showToast('Candidate added successfully!', 'success');
      setShowAddForm(false);
      await loadCandidates();
    } catch (err) {
      console.error('Failed to add candidate:', err);
      throw err;
    }
  };

  const handleEditCandidate = async (candidateData) => {
    try {
      const { tag_ids: tagIds = [], ...payload } = candidateData;
      await candidatesAPI.update(editingCandidate.id, payload);

      const existingTagIds = (editingCandidate.tags || []).map((tag) => tag.term);
      const tagsToAdd = tagIds.filter((tagId) => !existingTagIds.includes(tagId));
      const tagsToRemove = existingTagIds.filter((tagId) => !tagIds.includes(tagId));

      if (tagsToRemove.length > 0) {
        await Promise.all(
          tagsToRemove.map((tagId) => candidatesAPI.untagCandidate(editingCandidate.id, tagId))
        );
      }
      if (tagsToAdd.length > 0) {
        await Promise.all(
          tagsToAdd.map((tagId) => candidatesAPI.tagCandidate(editingCandidate.id, tagId))
        );
      }

      showToast('Candidate updated successfully!', 'success');
      setEditingCandidate(null);
      await loadCandidates();
    } catch (err) {
      console.error('Failed to update candidate:', err);
      throw err;
    }
  };

  const handleDeleteCandidate = async (candidateId) => {
    if (!window.confirm('Are you sure you want to delete this candidate?')) {
      return;
    }

    try {
      await candidatesAPI.delete(candidateId);
      showToast('Candidate deleted successfully!', 'success');
      await loadCandidates();
    } catch (err) {
      console.error('Failed to delete candidate:', err);
      showToast('Failed to delete candidate. Please try again.', 'error');
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const handleCloseToast = () => {
    setToast(null);
  };

  if (isLoading) {
    return (
      <div className="item-management-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading candidates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="item-management-page">
      <div className="page-header">
        <div className="header-content">
          <button
            className="back-button"
            onClick={() => navigate(`/sessions/${sessionId}`)}
          >
            ← Back
          </button>
          <div className="header-info">
            <h1 className="page-title">Manage Candidates</h1>
            {session && (
              <p className="decision-name">{session.title}</p>
            )}
          </div>
        </div>
        
        {isAdmin && !showAddForm && !editingCandidate && (
          <button
            className="add-item-button"
            onClick={() => setShowAddForm(true)}
          >
            + Add Candidate
          </button>
        )}
      </div>

      {(showAddForm || editingCandidate) && (
        <div className="form-container">
          <AddCandidateForm
            onSubmit={editingCandidate ? handleEditCandidate : handleAddCandidate}
            onCancel={() => {
              setShowAddForm(false);
              setEditingCandidate(null);
            }}
            initialData={editingCandidate}
            taxonomies={taxonomies}
          />
        </div>
      )}

      {!showAddForm && !editingCandidate && (
        <>
          <CandidateFilter
            taxonomies={taxonomies}
            onFilterChange={handleFilterChange}
          />

          <div className="items-container">
            <div className="items-header">
              <h2 className="items-count">
                {candidates.length} {candidates.length === 1 ? 'Candidate' : 'Candidates'}
              </h2>
            </div>

            <CandidateList
              candidates={candidates}
              onEdit={(candidate) => setEditingCandidate(candidate)}
              onDelete={handleDeleteCandidate}
              isAdmin={isAdmin}
            />
          </div>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleCloseToast}
        />
      )}
    </div>
  );
}

export default CandidateManagementPage;
