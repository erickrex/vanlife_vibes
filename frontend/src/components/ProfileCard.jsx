import React from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { DEFAULT_AVATAR } from '../utils/constants';

// Display labels for vehicle types
const VEHICLE_TYPE_LABELS = {
  van: 'Van',
  rv: 'RV',
  truck_camper: 'Truck Camper',
  skoolie: 'Skoolie',
  trailer: 'Trailer',
  car_camper: 'Car Camper',
  other: 'Other',
};

// Display labels for travel status
const TRAVEL_STATUS_LABELS = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  weekender: 'Weekender',
  aspiring: 'Aspiring',
};

/**
 * ProfileCard - A compact profile card component for displaying user profiles in lists.
 */
function ProfileCard({ profile }) {
  const {
    id,
    display_name,
    avatar_url,
    has_van,
    vehicle,
    travel_status,
  } = profile;

  // Get vehicle type label if user has a van
  const vehicleTypeLabel = has_van && vehicle?.vehicle_type
    ? VEHICLE_TYPE_LABELS[vehicle.vehicle_type] || vehicle.vehicle_type
    : null;

  // Get travel status label
  const travelStatusLabel = travel_status
    ? TRAVEL_STATUS_LABELS[travel_status] || travel_status
    : null;

  return (
    <Link 
      to={`/profile/${id}`} 
      className="flex items-center gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-zinc-700 flex-shrink-0">
        <img
          src={avatar_url || DEFAULT_AVATAR}
          alt={display_name || 'User'}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Profile Info */}
      <div className="flex-1 min-w-0">
        {/* Display Name */}
        <h3 className="text-white font-semibold truncate">
          {display_name || 'Anonymous'}
        </h3>

        {/* Tags Container */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {/* Vehicle Type Tag */}
          {vehicleTypeLabel && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
              🚐 {vehicleTypeLabel}
            </span>
          )}

          {/* Travel Status Tag */}
          {travelStatusLabel && (
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
              {travelStatusLabel}
            </span>
          )}
        </div>
      </div>

      {/* Chevron indicator */}
      <div className="text-zinc-500 flex-shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

ProfileCard.propTypes = {
  profile: PropTypes.shape({
    id: PropTypes.string.isRequired,
    display_name: PropTypes.string,
    avatar_url: PropTypes.string,
    has_van: PropTypes.bool,
    vehicle: PropTypes.shape({
      vehicle_type: PropTypes.string,
    }),
    travel_status: PropTypes.string,
  }).isRequired,
};

export default ProfileCard;
