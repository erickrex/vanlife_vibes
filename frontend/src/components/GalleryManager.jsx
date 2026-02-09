import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { profilesAPI } from '../services/api';

/**
 * GalleryManager Component
 * 
 * Manages gallery photos for a user profile.
 * 
 * @param {Array} photos - Array of gallery photo objects with id, url, display_order
 * @param {function} onPhotosChange - Callback when photos are added/deleted
 * @param {boolean} disabled - Whether the component is disabled (e.g., during save)
 * @param {string} className - Additional CSS classes
 */
function GalleryManager({
  photos = [],
  onPhotosChange,
  disabled = false,
  className = '',
}) {
  const MAX_PHOTOS = 6;
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const photoCount = photos.length;
  const canAddMore = photoCount < MAX_PHOTOS;

  // Handle file selection
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Reset file input for future selections
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('photo_type', 'gallery');
      formData.append('display_order', photoCount);

      const response = await profilesAPI.uploadPhoto(formData);
      
      // Call callback with updated photos
      if (onPhotosChange) {
        const newPhoto = {
          id: response.data.id,
          url: response.data.url,
          display_order: response.data.display_order,
        };
        onPhotosChange([...photos, newPhoto]);
      }
    } catch (err) {
      const errorMessage = err.message || 'Upload failed. Please try again.';
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Handle photo deletion
  const handleDelete = async (photoId) => {
    if (disabled || deletingId) return;

    setError(null);
    setDeletingId(photoId);

    try {
      await profilesAPI.deletePhoto(photoId);
      
      // Call callback with updated photos
      if (onPhotosChange) {
        const updatedPhotos = photos.filter(p => p.id !== photoId);
        onPhotosChange(updatedPhotos);
      }
    } catch (err) {
      const errorMessage = err.message || 'Delete failed. Please try again.';
      setError(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  // Trigger file input click
  const handleAddClick = () => {
    if (!canAddMore || disabled || uploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with photo count */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Gallery Photos</h3>
        <span className="text-sm text-zinc-500">
          {photoCount}/{MAX_PHOTOS} photos
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Existing Photos */}
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 group"
          >
            <img
              src={photo.url}
              alt="Gallery photo"
              className="w-full h-full object-cover"
            />
            
            {/* Delete Button - visible on hover or when deleting */}
            <button
              type="button"
              onClick={() => handleDelete(photo.id)}
              disabled={disabled || deletingId === photo.id}
              className={`
                absolute top-2 right-2 
                bg-black/60 hover:bg-red-500 
                disabled:bg-black/40 disabled:cursor-not-allowed
                rounded-full p-1.5
                transition-all duration-200
                ${deletingId === photo.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
              `}
              aria-label="Delete photo"
            >
              {deletingId === photo.id ? (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>

            {/* Loading overlay when deleting */}
            {deletingId === photo.id && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
        ))}

        {/* Add Photo Button */}
        {canAddMore && (
          <button
            type="button"
            onClick={handleAddClick}
            disabled={disabled || uploading}
            className={`
              aspect-square rounded-xl 
              border-2 border-dashed border-zinc-600 
              hover:border-zinc-500 
              disabled:border-zinc-700 disabled:cursor-not-allowed
              bg-zinc-800/50 hover:bg-zinc-800
              flex flex-col items-center justify-center gap-2
              transition-all duration-200
            `}
            aria-label="Add photo"
          >
            {uploading ? (
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <>
                <svg
                  className="w-8 h-8 text-zinc-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="text-xs text-zinc-500 font-medium">Add Photo</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Helper text */}
      <p className="text-xs text-zinc-500">
        Supported formats: JPEG, PNG, WebP (max 10MB)
      </p>
    </div>
  );
}

GalleryManager.propTypes = {
  photos: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      display_order: PropTypes.number,
    })
  ),
  onPhotosChange: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default GalleryManager;
