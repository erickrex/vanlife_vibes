import { useState, useRef } from 'react';
import { profilesAPI } from '../services/api';

/**
 * PhotoUploader Component
 * 
 * A reusable component for uploading profile photos (avatar, cover, gallery).
 * Supports file selection, preview generation, and upload with loading states.
 * 
 * @param {string} photoType - Type of photo: 'avatar' | 'cover' | 'gallery'
 * @param {string} currentUrl - Current photo URL (if any)
 * @param {function} onUploadSuccess - Callback with new photo data on success
 * @param {function} onUploadError - Callback with error message on failure
 * @param {string} className - Additional CSS classes
 */
function PhotoUploader({
  photoType,
  currentUrl,
  onUploadSuccess,
  onUploadError,
  className = '',
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Determine aspect ratio and sizing based on photo type
  const getPhotoStyles = () => {
    switch (photoType) {
      case 'avatar':
        return {
          container: 'w-32 h-32 rounded-full',
          image: 'w-full h-full rounded-full object-cover',
          placeholder: 'w-32 h-32 rounded-full',
        };
      case 'cover':
        return {
          container: 'w-full aspect-[2/1] rounded-xl',
          image: 'w-full h-full rounded-xl object-cover',
          placeholder: 'w-full aspect-[2/1] rounded-xl',
        };
      case 'gallery':
        return {
          container: 'w-full aspect-square rounded-xl',
          image: 'w-full h-full rounded-xl object-cover',
          placeholder: 'w-full aspect-square rounded-xl',
        };
      default:
        return {
          container: 'w-32 h-32 rounded-xl',
          image: 'w-full h-full rounded-xl object-cover',
          placeholder: 'w-32 h-32 rounded-xl',
        };
    }
  };

  const styles = getPhotoStyles();

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Clear previous state
    setError(null);
    setFile(selectedFile);

    // Generate preview using FileReader
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
      setFile(null);
      setPreview(null);
    };
    reader.readAsDataURL(selectedFile);
  };

  // Handle upload
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('photo_type', photoType);

      const response = await profilesAPI.uploadPhoto(formData);
      
      // Clear local state on success
      setFile(null);
      setPreview(null);
      
      // Call success callback with response data
      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
    } catch (err) {
      const errorMessage = err.message || 'Upload failed. Please try again.';
      setError(errorMessage);
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setUploading(false);
    }
  };

  // Handle cancel/clear preview
  const handleCancel = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Trigger file input click
  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  // Determine what image to display
  const displayImage = preview || currentUrl;

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Photo Display Area */}
      <div className={`relative ${styles.container} bg-zinc-800 border-2 border-dashed border-zinc-600 overflow-hidden`}>
        {displayImage ? (
          <img
            src={displayImage}
            alt={`${photoType} photo`}
            className={styles.image}
          />
        ) : (
          <div className={`${styles.placeholder} flex items-center justify-center bg-zinc-800`}>
            <svg
              className="w-12 h-12 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Loading Overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Preview Badge */}
        {preview && !uploading && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 bg-amber-500/90 text-white text-xs font-medium rounded-full">
              Preview
            </span>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {preview ? (
          <>
            {/* Upload Button */}
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancel}
              disabled={uploading}
              className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 disabled:border-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          /* Select Photo Button */
          <button
            type="button"
            onClick={handleSelectClick}
            disabled={uploading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {currentUrl ? 'Change Photo' : 'Select Photo'}
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="w-full max-w-xs p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}

      {/* File Type Hint */}
      <p className="text-xs text-zinc-500 text-center">
        Supported formats: JPEG, PNG, WebP (max 10MB)
      </p>
    </div>
  );
}

export default PhotoUploader;
