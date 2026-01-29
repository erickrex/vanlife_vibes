import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsAPI } from '../services/api';
import CreateSessionForm from '../components/CreateSessionForm';
import './CreateSessionPage.css';

function CreateSessionPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (sessionData) => {
    try {
      const response = await sessionsAPI.create(sessionData);
      // Navigate to the newly created session
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
    <div className="create-decision-page">
      <div className="page-container">
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
