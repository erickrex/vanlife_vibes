import React, { useState } from 'react';

function MessageInput({ onSendMessage, disabled = false }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const trimmedText = text.trim();
    if (!trimmedText || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(trimmedText);
      setText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="flex items-center gap-2 p-3 border-t border-zinc-800" onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type a message..."
        disabled={disabled || isSending}
        rows="1"
        className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-full text-white text-sm placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-600 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled || isSending}
        className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-full text-white transition-colors"
      >
        {isSending ? '...' : '➤'}
      </button>
    </form>
  );
}

export default MessageInput;
