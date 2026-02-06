import { useState, useEffect, useRef } from 'react';

/**
 * LazyImage component with Intersection Observer for performance optimization
 * Loads images only when they're about to enter the viewport
 */
const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  placeholder = null,
  threshold = 0.1,
  rootMargin = '50px'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load image immediately if IO not supported
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [threshold, rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div ref={imgRef} className={`relative w-full h-full overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800">
          {placeholder || (
            <div className="w-10 h-10 border-4 border-white/30 border-t-white/80 rounded-full animate-spin" />
          )}
        </div>
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          loading="lazy"
        />
      )}
    </div>
  );
};

export default LazyImage;
