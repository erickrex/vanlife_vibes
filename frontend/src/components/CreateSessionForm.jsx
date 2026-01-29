import React, { useState } from 'react';
import RuleSelector from './RuleSelector';
import './CreateSessionForm.css';

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
    <form className="create-decision-form" onSubmit={handleSubmit}>
      <h2 className="form-title">Create New Session</h2>
      
      {errors.submit && (
        <div className="error-message">{errors.submit}</div>
      )}
      
      <div className="form-group">
        <label htmlFor="title" className="form-label">
          Title <span className="required">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className={`form-input ${errors.title ? 'error' : ''}`}
          placeholder="e.g., Choose our next team lunch spot"
          disabled={isSubmitting}
        />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </div>
      
      <div className="form-group">
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="form-textarea"
          placeholder="Provide additional context about this session..."
          rows="3"
          disabled={isSubmitting}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="candidate_type" className="form-label">
          Candidate Type
        </label>
        <input
          type="text"
          id="candidate_type"
          name="candidate_type"
          value={formData.candidate_type}
          onChange={handleChange}
          className={`form-input ${errors.candidate_type ? 'error' : ''}`}
          placeholder="e.g., Restaurants, Apartments, Features"
          disabled={isSubmitting}
        />
        {errors.candidate_type && <span className="field-error">{errors.candidate_type}</span>}
        <span className="field-hint">
          Define the kind of candidates your group will review and swipe on.
        </span>
      </div>
      
      <div className="form-group">
        <label className="form-label">
          Approval Rule <span className="required">*</span>
        </label>
        <RuleSelector
          rules={formData.rules}
          onChange={handleRuleChange}
          disabled={isSubmitting}
        />
        {errors.rules && <span className="field-error">{errors.rules}</span>}
      </div>
      
      <div className="form-group">
        <label htmlFor="status" className="form-label">
          Initial Status
        </label>
        <select
          id="status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="form-select"
          disabled={isSubmitting}
        >
          <option value="draft">Draft (not yet open for swiping)</option>
          <option value="open">Open (ready for swiping)</option>
        </select>
      </div>
      
      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          className="cancel-button"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Session'}
        </button>
      </div>
    </form>
  );
}

export default CreateSessionForm;
