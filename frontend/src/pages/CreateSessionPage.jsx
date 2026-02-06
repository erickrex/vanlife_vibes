import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsAPI } from '../services/api';
import CreateSessionForm from '../components/CreateSessionForm';

function CreateSessionPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (sessionData) => {
    try {
      const response = await sessionsAPI.create(sessionData);
      const sessionId = response.data.data?.id || response.data.id;
      navigate(`/sessions/${sessionId}`);
    } catch (err) {
      throw new Error(err.message || 'Failed to create session');
    }
  };

  const handleCancel = () => {
    navigate(`/groups/${groupId}`);
  };

  return (
    <div className="min-h-screen bg-black px-4 pb-20 pt-4">
      <div className="max-w-3xl mx-auto">
        <CreateSessionForm
          groupId={groupId}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

export default CreateSessionPage;
