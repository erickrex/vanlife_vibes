import { useState, useRef, useEffect } from 'react';
import { locationsAPI } from '../services/api';

/**
 * City Autocomplete Component
 * 
 * A text input with autocomplete suggestions for US cities.
 * Designed for van lifers to quickly select their location.
 */
function CityAutocomplete({ 
  value, 
  onChange, 
  placeholder = 'Search cities...', 
  disabled = false,
  name = 'city',
  inputClassName = '',
  dropdownClassName = '',
  itemClassName = ''
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const lastValidRef = useRef(value || '');
  const requestIdRef = useRef(0);

  // Sync input value with prop when it changes externally (using key pattern)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setInputValue(value || '');
    if (value) {
      lastValidRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (e) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(e.target) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCities = async (query) => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      const response = await locationsAPI.getCities(query);
      if (requestId !== requestIdRef.current) return;
      const data = response.data.data || response.data || [];
      setSuggestions(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setSuggestions([]);
      console.error('Failed to fetch cities', err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(true);
    setHighlightedIndex(-1);
    fetchCities(newValue.trim());
  };

  const handleFocus = () => {
    setShowSuggestions(true);
    fetchCities(inputValue.trim());
  };

  const handleSelect = (city) => {
    const display = city.display_name || city;
    setInputValue(display);
    lastValidRef.current = display;
    onChange({ target: { name, value: display } });
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(suggestions[highlightedIndex]);
        } else if (inputValue.trim()) {
          const exact = suggestions.find(
            (city) => city.display_name?.toLowerCase() === inputValue.trim().toLowerCase()
          );
          if (exact) {
            handleSelect(exact);
          }
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Small delay to allow click on suggestion
    setTimeout(() => {
      const exact = suggestions.find(
        (city) => city.display_name?.toLowerCase() === inputValue.trim().toLowerCase()
      );
      if (exact) {
        handleSelect(exact);
        return;
      }
      if (inputValue.trim() && inputValue.trim() !== lastValidRef.current) {
        setInputValue(lastValidRef.current);
      }
    }, 150);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName || "app-input disabled:opacity-50"}
        autoComplete="off"
      />
      
      {showSuggestions && (suggestions.length > 0 || loading) && (
        <ul
          ref={suggestionsRef}
          className={dropdownClassName || "absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"}
        >
          {loading && (
            <li className={itemClassName || "px-4 py-2 text-zinc-400"}>
              Loading cities...
            </li>
          )}
          {!loading && suggestions.map((city, index) => (
            <li
              key={city.id || city.display_name}
              onClick={() => handleSelect(city)}
              className={itemClassName ? `${itemClassName} ${index === highlightedIndex ? 'bg-zinc-700' : ''}` : `px-4 py-2 cursor-pointer transition-colors ${
                index === highlightedIndex 
                  ? 'bg-zinc-700 text-white' 
                  : 'text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {`📍 ${city.display_name}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CityAutocomplete;
