import React, { useState } from 'react';
import RuleSelector from './RuleSelector';

function CreateSessionForm({ groupId, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    candidate_type: '',
    rules: { type: 'unanimous' },
    status: 'draft'
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRuleChange = (rules) => {
    setFormData(prev => ({
      ...prev,
      rules
    }));
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.rules || !formData.rules.type) {
      newErrors.rules = 'Approval rule is required';
    }
    
    if (formData.rules.type === 'threshold' && 
        (formData.rules.value === undefined || 
         formData.rules.value < 0 || 
         formData.rules.value > 1)) {
      newErrors.rules = 'Threshold must be between 0 and 1';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const sessionData = {
        ...formData,
        group: groupId
      };
      await onSubmit(sessionData);
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to create session' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="bg-zinc-900 rounded-xl p-4 md:p-8 max-w-xl mx-auto border border-zinc-800" onSubmit={handleSubmit}>
      <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Create New Session</h2>
      
      {errors.submit && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm">
          {errors.submit}
        </div>
      )}
      
      <div className="mb-6">
        <label htmlFor="title" className="block font-semibold text-zinc-300 mb-2 text-sm">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className={`w-full px-4 py-3 bg-zinc-800 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
            errors.title ? 'border-red-500' : 'border-zinc-700'
          }`}
          placeholder="e.g., Choose our next team lunch spot"
          disabled={isSubmitting}
        />
        {errors.title && <span className="text-red-400 text-sm mt-1 block">{errors.title}</span>}
      </div>
      
      <div className="mb-6">
        <label htmlFor="description" className="block font-semibold text-zinc-300 mb-2 text-sm">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-y min-h-[80px]"
          placeholder="Provide additional context about this session..."
          rows="3"
          disabled={isSubmitting}
        />
      </div>
      
      <div className="mb-6">
        <label htmlFor="candidate_type" className="block font-semibold text-zinc-300 mb-2 text-sm">
          Candidate Type
        </label>
        <input
          type="text"
          id="candidate_type"
          name="candidate_type"
          value={formData.candidate_type}
          onChange={handleChange}
          className={`w-full px-4 py-3 bg-zinc-800 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
            errors.candidate_type ? 'border-red-500' : 'border-zinc-700'
          }`}
          placeholder="e.g., Restaurants, Apartments, Features"
          disabled={isSubmitting}
        />
        {errors.candidate_type && <span className="text-red-400 text-sm mt-1 block">{errors.candidate_type}</span>}
        <span className="text-zinc-500 text-sm mt-1 block">
          Define the kind of candidates your group will review and swipe on.
        </span>
      </div>
      
      <div className="mb-6">
        <label className="block font-semibold text-zinc-300 mb-2 text-sm">
          Approval Rule <span className="text-red-400">*</span>
        </label>
        <RuleSelector
          rules={formData.rules}
          onChange={handleRuleChange}
          disabled={isSubmitting}
        />
        {errors.rules && <span className="text-red-400 text-sm mt-1 block">{errors.rules}</span>}
      </div>
      
      <div className="mb-6">
        <label htmlFor="status" className="block font-semibold text-zinc-300 mb-2 text-sm">
          Initial Status
        </label>
        <select
          id="status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          <option value="draft">Draft (not yet open for swiping)</option>
          <option value="open">Open (ready for swiping)</option>
        </select>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mt-8 pt-6 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Session'}
        </button>
      </div>
    </form>
  );
}

export default CreateSessionForm;
