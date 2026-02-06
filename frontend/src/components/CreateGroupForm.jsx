import React, { useState } from 'react';

function CreateGroupForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Group name must be at least 3 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim(),
      });
      
      // Reset form on success
      setFormData({ name: '', description: '' });
      setErrors({});
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to create group' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-xl font-bold text-white">Create New Group</h2>
      
      <div>
        <label htmlFor="name" className="block text-white text-sm font-medium mb-2">
          Group Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 ${
            errors.name ? 'border-red-500' : 'border-zinc-700'
          }`}
          disabled={isSubmitting}
          placeholder="Enter group name"
          maxLength={100}
        />
        {errors.name && <span className="text-red-400 text-sm mt-1 block">{errors.name}</span>}
      </div>

      <div>
        <label htmlFor="description" className="block text-white text-sm font-medium mb-2">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="What is this group about?"
          rows={4}
          maxLength={500}
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
        />
        <span className="text-zinc-500 text-xs mt-1 block text-right">
          {formData.description.length}/500
        </span>
      </div>

      {errors.submit && (
        <div className="px-4 py-3 bg-red-900/50 border border-red-800 rounded-lg">
          <span className="text-red-300 text-sm">{errors.submit}</span>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button 
            type="button" 
            className="flex-1 px-4 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-semibold rounded-lg transition-colors" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button 
          type="submit" 
          className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors" 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </form>
  );
}

export default CreateGroupForm;
