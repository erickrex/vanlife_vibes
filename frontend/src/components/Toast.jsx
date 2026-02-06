import React, { useEffect } from 'react';

function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const typeStyles = {
    info: 'bg-blue-500 text-white',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-black',
  };

  return (
    <div 
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-up ${typeStyles[type] || typeStyles.info}`}
    >
      <span className="text-sm font-medium">{message}</span>
      <button 
        className="text-current opacity-70 hover:opacity-100 transition-opacity"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

export default Toast;
