import React, { useState, useEffect } from 'react';
import TagSelector from './TagSelector';

function AddCandidateForm({ onSubmit, onCancel, initialData, taxonomies }) {
  const [formData, setFormData] = useState({
    label: '',
    external_ref: '',
    attributes: {},
    tag_ids: []
  });
  const [attributeKey, setAttributeKey] = useState('');
  const [attributeValue, setAttributeValue] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        label: initialData.label || '',
        external_ref: initialData.external_ref || '',
        attributes: initialData.attributes || {},
        tag_ids: initialData.tags?.map(tag => tag.term) || []
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddAttribute = () => {
    if (!attributeKey.trim()) {
      setErrors(prev => ({ ...prev, attribute: 'Attribute key is required' }));
      return;
    }

    // Try to parse value as JSON, otherwise use as string
    let parsedValue = attributeValue;
    try {
      // Check if it looks like a number
      if (!isNaN(attributeValue) && attributeValue.trim() !== '') {
        parsedValue = Number(attributeValue);
      } else if (attributeValue.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (attributeValue.toLowerCase() === 'false') {
        parsedValue = false;
      } else if (attributeValue.startsWith('{') || attributeValue.startsWith('[')) {
        parsedValue = JSON.parse(attributeValue);
      }
    } catch (e) {
      // Keep as string if parsing fails
    }

    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attributeKey]: parsedValue
      }
    }));

    setAttributeKey('');
    setAttributeValue('');
    setErrors(prev => ({ ...prev, attribute: '' }));
  };

  const handleRemoveAttribute = (key) => {
    setFormData(prev => {
      const newAttributes = { ...prev.attributes };
      delete newAttributes[key];
      return {
        ...prev,
        attributes: newAttributes
      };
    });
  };

  const handleTagsChange = (selectedTermIds) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: selectedTermIds
    }));
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.label.trim()) {
      newErrors.label = 'Label is required';
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
      await onSubmit(formData);
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to save candidate' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAttributeValue = (value) => {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <form className="bg-zinc-900 rounded-xl p-4 md:p-6 max-w-xl mx-auto border border-zinc-800" onSubmit={handleSubmit}>
      <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">
        {initialData ? 'Edit Candidate' : 'Add New Candidate'}
      </h2>
      
      {errors.submit && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm">
          {errors.submit}
        </div>
      )}
      
      <div className="mb-6">
        <label htmlFor="label" className="block font-semibold text-zinc-300 mb-2 text-sm">
          Label <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="label"
          name="label"
          value={formData.label}
          onChange={handleChange}
          className={`w-full px-4 py-3 bg-zinc-800 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors ${
            errors.label ? 'border-red-500' : 'border-zinc-700'
          }`}
          placeholder="e.g., Italian Restaurant Downtown"
          disabled={isSubmitting}
        />
        {errors.label && <span className="text-red-400 text-sm mt-1 block">{errors.label}</span>}
      </div>
      
      <div className="mb-6">
        <label htmlFor="external_ref" className="block font-semibold text-zinc-300 mb-2 text-sm">
          External Reference
        </label>
        <input
          type="text"
          id="external_ref"
          name="external_ref"
          value={formData.external_ref}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          placeholder="e.g., yelp-12345"
          disabled={isSubmitting}
        />
        <span className="text-zinc-500 text-sm mt-1 block">
          Optional unique identifier from external system
        </span>
      </div>
      
      <div className="mb-6">
        <label className="block font-semibold text-zinc-300 mb-2 text-sm">Attributes</label>
        
        {Object.keys(formData.attributes).length > 0 && (
          <div className="flex flex-col gap-2 mb-4 p-3 bg-zinc-800 rounded-lg">
            {Object.entries(formData.attributes).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center p-2 bg-zinc-900 rounded gap-2">
                <span className="flex-1 text-sm text-zinc-300 break-words">
                  <span className="text-zinc-500 font-semibold">{key}:</span> {formatAttributeValue(value)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttribute(key)}
                  className="w-11 h-11 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded transition-colors text-xl"
                  disabled={isSubmitting}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-start">
          <input
            type="text"
            value={attributeKey}
            onChange={(e) => setAttributeKey(e.target.value)}
            className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            placeholder="Key (e.g., price)"
            disabled={isSubmitting}
          />
          <input
            type="text"
            value={attributeValue}
            onChange={(e) => setAttributeValue(e.target.value)}
            className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            placeholder="Value (e.g., 25)"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={handleAddAttribute}
            className="w-full md:w-auto px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 min-h-[44px]"
            disabled={isSubmitting}
          >
            Add
          </button>
        </div>
        {errors.attribute && <span className="text-red-400 text-sm mt-1 block">{errors.attribute}</span>}
        <span className="text-zinc-500 text-sm mt-2 block">
          Add custom attributes as key-value pairs. Numbers and booleans will be auto-detected.
        </span>
      </div>
      
      {taxonomies && taxonomies.length > 0 && (
        <div className="mb-6">
          <label className="block font-semibold text-zinc-300 mb-2 text-sm">Tags</label>
          <TagSelector
            taxonomies={taxonomies}
            selectedTermIds={formData.tag_ids}
            onChange={handleTagsChange}
            disabled={isSubmitting}
          />
        </div>
      )}
      
      <div className="flex flex-col-reverse md:flex-row gap-3 justify-end mt-8 pt-4 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="w-full md:w-auto px-6 py-3 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 min-h-[44px]"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : (initialData ? 'Update Candidate' : 'Add Candidate')}
        </button>
      </div>
    </form>
  );
}

export default AddCandidateForm;
