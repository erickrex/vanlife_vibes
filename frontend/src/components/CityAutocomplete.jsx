import { useState, useRef, useEffect } from 'react';

// Popular US cities for van lifers/nomads - focused on Southwest and popular destinations
const US_CITIES = [
  // Utah
  'Moab, UT', 'Salt Lake City, UT', 'St. George, UT', 'Park City, UT', 'Kanab, UT',
  'Zion National Park, UT', 'Arches National Park, UT', 'Canyonlands, UT', 'Capitol Reef, UT',
  'Bryce Canyon, UT', 'Monument Valley, UT', 'Lake Powell, UT',
  // Colorado
  'Denver, CO', 'Boulder, CO', 'Colorado Springs, CO', 'Fort Collins, CO', 'Durango, CO',
  'Telluride, CO', 'Aspen, CO', 'Steamboat Springs, CO', 'Estes Park, CO', 'Grand Junction, CO',
  'Ouray, CO', 'Crested Butte, CO', 'Glenwood Springs, CO',
  // California
  'Los Angeles, CA', 'San Diego, CA', 'San Francisco, CA', 'Joshua Tree, CA', 'Big Sur, CA',
  'Lake Tahoe, CA', 'Yosemite, CA', 'Death Valley, CA', 'Palm Springs, CA', 'Santa Barbara, CA',
  'Malibu, CA', 'Monterey, CA', 'Redwood National Park, CA', 'Sequoia National Park, CA',
  'Bishop, CA', 'Mammoth Lakes, CA', 'Ventura, CA', 'Santa Cruz, CA',
  // Nevada
  'Las Vegas, NV', 'Reno, NV', 'Valley of Fire, NV', 'Lake Mead, NV', 'Great Basin, NV',
  // Arizona
  'Phoenix, AZ', 'Tucson, AZ', 'Sedona, AZ', 'Flagstaff, AZ', 'Grand Canyon, AZ',
  'Page, AZ', 'Lake Havasu City, AZ', 'Prescott, AZ', 'Jerome, AZ', 'Bisbee, AZ',
  // New Mexico
  'Santa Fe, NM', 'Albuquerque, NM', 'Taos, NM', 'Carlsbad, NM', 'White Sands, NM',
  'Las Cruces, NM', 'Roswell, NM',
  // Texas
  'Austin, TX', 'San Antonio, TX', 'Big Bend, TX', 'Marfa, TX', 'El Paso, TX',
  'Fredericksburg, TX', 'South Padre Island, TX',
  // Oregon
  'Portland, OR', 'Bend, OR', 'Eugene, OR', 'Ashland, OR', 'Crater Lake, OR',
  'Hood River, OR', 'Cannon Beach, OR', 'Astoria, OR',
  // Washington
  'Seattle, WA', 'Spokane, WA', 'Olympic National Park, WA', 'Mount Rainier, WA',
  'Bellingham, WA', 'Leavenworth, WA', 'Walla Walla, WA',
  // Montana
  'Bozeman, MT', 'Missoula, MT', 'Glacier National Park, MT', 'Whitefish, MT', 'Helena, MT',
  // Wyoming
  'Jackson Hole, WY', 'Yellowstone, WY', 'Grand Teton, WY', 'Cody, WY', 'Laramie, WY',
  // Idaho
  'Boise, ID', 'Sun Valley, ID', 'Coeur d\'Alene, ID', 'McCall, ID',
  // Florida
  'Miami, FL', 'Key West, FL', 'Tampa, FL', 'Orlando, FL', 'St. Augustine, FL',
  'Everglades, FL', 'Destin, FL',
  // Other popular spots
  'Nashville, TN', 'Asheville, NC', 'Charleston, SC', 'Savannah, GA',
  'New Orleans, LA', 'Acadia, ME', 'Burlington, VT', 'Bar Harbor, ME',
].sort();

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
  showOpenPlans = false,
  name = 'city'
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
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

  const filterCities = (query) => {
    if (!query.trim()) {
      // Show "Open plans" first if enabled, then popular cities
      const results = showOpenPlans ? ['Open plans'] : [];
      return [...results, ...US_CITIES.slice(0, 10)];
    }
    
    const lowerQuery = query.toLowerCase();
    const matches = US_CITIES.filter(city => 
      city.toLowerCase().includes(lowerQuery)
    ).slice(0, 10);
    
    // Add "Open plans" option if enabled and query matches
    if (showOpenPlans && 'open plans'.includes(lowerQuery)) {
      return ['Open plans', ...matches];
    }
    
    return matches;
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSuggestions(filterCities(newValue));
    setShowSuggestions(true);
    setHighlightedIndex(-1);
  };

  const handleFocus = () => {
    setSuggestions(filterCities(inputValue));
    setShowSuggestions(true);
  };

  const handleSelect = (city) => {
    setInputValue(city);
    onChange({ target: { name, value: city } });
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
          // Allow custom input
          onChange({ target: { name, value: inputValue.trim() } });
          setShowSuggestions(false);
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
      if (inputValue.trim() && inputValue !== value) {
        onChange({ target: { name, value: inputValue.trim() } });
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
        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
        autoComplete="off"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <ul
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((city, index) => (
            <li
              key={city}
              onClick={() => handleSelect(city)}
              className={`px-4 py-2 cursor-pointer transition-colors ${
                index === highlightedIndex 
                  ? 'bg-zinc-700 text-white' 
                  : 'text-zinc-300 hover:bg-zinc-700 hover:text-white'
              } ${city === 'Open plans' ? 'text-yellow-400 font-medium' : ''}`}
            >
              {city === 'Open plans' ? '🗺️ Open plans (flexible)' : `📍 ${city}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CityAutocomplete;
