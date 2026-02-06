import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CandidateList from '../components/CandidateList';
import AddCandidateForm from '../components/AddCandidateForm';
import CandidateFilter from '../components/CandidateFilter';
import Toast from '../components/Toast';
import { candidatesAPI, taxonomiesAPI, sessionsAPI, groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
      
      const sessionResponse = await sessionsAPI.get(sessionId);
      const sessionData = sessionResponse.data.data;
      setSession(sessionData);
      
      try {
        const membersResponse = await groupsAPI.listMembers(sessionData.group);
        const members = membersResponse.data.data || [];
        const currentUserMembership = members.find(m => m.user?.id === user?.id);
        setIsAdmin(currentUserMembership?.role === 'admin');
      } catch (err) {
        console.error('Failed to check admin status:', err);
        setIsAdmin(false);
      }
      
      const taxonomiesResponse = await taxonomiesAPI.list();
      const taxonomiesData = taxonomiesResponse.data.data || [];

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
      
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach((tagId) => {
          params.append('tag', tagId);
        });
      }
      
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
      <div className="min-h-screen bg-black px-4 pb-20 pt-4">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[400px] gap-4 text-zinc-400">
          <div className="w-10 h-10 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
          <p>Loading candidates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 pb-20 pt-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
          <div className="flex-1">
            <button
              className="text-blue-500 hover:text-blue-400 font-semibold bg-transparent border-none cursor-pointer py-2 mb-2 min-h-[44px] flex items-center transition-colors"
              onClick={() => navigate(`/sessions/${sessionId}`)}
            >
              ← Back
            </button>
            <div className="mt-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white m-0 mb-1">Manage Candidates</h1>
              {session && (
                <p className="text-zinc-400 m-0">{session.title}</p>
              )}
            </div>
          </div>
          
          {isAdmin && !showAddForm && !editingCandidate && (
            <button
              className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 shadow-lg whitespace-nowrap min-h-[44px]"
              onClick={() => setShowAddForm(true)}
            >
              + Add Candidate
            </button>
          )}
        </div>

        {(showAddForm || editingCandidate) && (
          <div className="mb-8 bg-zinc-900 rounded-xl border border-zinc-800">
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

            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-zinc-800">
                <h2 className="text-xl font-semibold text-white m-0">
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
    </div>
  );
}

export default CandidateManagementPage;
