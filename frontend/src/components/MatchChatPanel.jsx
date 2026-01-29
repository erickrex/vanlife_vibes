import React, { useEffect, useState, useCallback } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import './MatchChatPanel.css';
import { matchMessagesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function MatchChatPanel({ match }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!match) {
      setMessages([]);
      setLoading(false);
      setError('');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await matchMessagesAPI.list(match.id);
      const payload = response.data.data || response.data;
      const sortedMessages = Array.isArray(payload) ? payload : [];
      setMessages(sortedMessages);
    } catch (err) {
      setError(err.message || 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [match]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSendMessage = async (content) => {
    if (!match) return;

    try {
      setSending(true);
      const response = await matchMessagesAPI.create(match.id, content);
      const message = response.data.data || response.data;
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setSending(false);
    }
  };

  if (!match) {
    return (
      <div className="match-chat-panel empty">
        <p>Select a match to open its chat thread.</p>
      </div>
    );
  }

  return (
    <div className="match-chat-panel">
      <div className="match-chat-header">
        <div>
          <p className="match-chat-title">{match.candidate?.label || 'Match'}</p>
          <span className="match-chat-subtitle">
            Group chat · {match.snapshot?.approvals || 0} approvals
          </span>
        </div>
        <button onClick={loadMessages} className="match-chat-refresh">
          ↻ Refresh
        </button>
      </div>

      {error && <p className="chat-error">{error}</p>}

      <MessageList
        messages={messages}
        loading={loading}
        currentUserId={user?.id}
      />

      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={sending || loading}
      />
    </div>
  );
}

export default MatchChatPanel;
