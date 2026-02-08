import React, { useState, useRef, useEffect } from 'react';

function PersonMessageInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...',
  mode = 'friends',
}) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = async (event) => {
    event?.preventDefault();

    const trimmedText = text.trim();
    if (!trimmedText || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSendMessage(trimmedText);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const sendButtonClass =
    mode === 'dating'
      ? 'bg-rose-500 hover:bg-rose-600 text-white'
      : 'bg-blue-500 hover:bg-blue-600 text-white';

  return (
    <form className="flex items-end gap-2 p-3 border-t border-zinc-800 bg-zinc-900/85" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSending}
        rows="1"
        className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-2xl text-white text-sm placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        maxLength={1000}
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled || isSending}
        className={`w-11 h-11 flex items-center justify-center rounded-full transition-all disabled:bg-zinc-700 disabled:cursor-not-allowed ${sendButtonClass}`}
        title="Send message"
      >
        {isSending ? <span className="text-sm">...</span> : <span className="text-lg">➤</span>}
      </button>
    </form>
  );
}

export default PersonMessageInput;
