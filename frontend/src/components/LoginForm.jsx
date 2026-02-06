import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const result = await login({
      username: formData.username,
      password: formData.password,
    });
    setIsSubmitting(false);

    if (result.success) {
      navigate('/feed');
    } else {
      setErrors({ submit: result.error });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Username */}
      <div className="space-y-1.5">
        <label htmlFor="username" className="block text-sm font-medium text-zinc-300">
          Username
        </label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
          disabled={isSubmitting}
          autoComplete="username"
          className={`w-full px-4 py-3 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
            ${errors.username ? 'border-red-500' : 'border-zinc-700'}`}
          placeholder="Enter your username"
        />
        {errors.username && (
          <p className="text-sm text-red-400">{errors.username}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            disabled={isSubmitting}
            autoComplete="current-password"
            className={`w-full px-4 py-3 pr-12 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
              ${errors.password ? 'border-red-500' : 'border-zinc-700'}`}
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-400">{errors.password}</p>
        )}
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{errors.submit}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed 
          text-white font-semibold rounded-lg transition-colors"
      >
        {isSubmitting ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}

export default LoginForm;
