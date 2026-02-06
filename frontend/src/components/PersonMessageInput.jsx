import React, { useState, useRef, useEffect } from 'react';

/**
 * PersonMessageInput - Message input for person-to-person chat
 * 
 * Features:
 * - Auto-expanding textarea
 * - Send on Enter (Shift+Enter for new line)
 * - Disabled state while sending
 * 
 * **Validates: Requirements 10.1**
 */
function PersonMessageInput({ onSendMessage, disabled = false, placeholder = 'Type a message...' }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = async (e) => {
    e?.preventDefault();

    const trimmedText = text.trim();
    if (!trimmedText || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSendMessage(trimmedText);
      setText('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form className="flex items-end gap-2 p-3 border-t border-zinc-800 bg-zinc-900" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSending}
        rows="1"
        className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-2xl text-white text-sm placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        maxLength={1000}
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled || isSending}
        className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-full text-white transition-colors"
        title="Send message"
      >
        {isSending ? (
          <span className="text-sm">...</span>
        ) : (
          <span className="text-lg">➤</span>
        )}
      </button>
    </form>
  );
}

export default PersonMessageInput;
