import { useState } from 'react';
import {
  Droplets,
  Mail,
  Lock,
  UserRound,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';
import { supabase } from './supabaseClient.js';
import './Auth.css';

function AuthPage() {
  const [mode, setMode] = useState('login');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setMessage('');

    if (isRegister && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage('Account created successfully!');
        } else {
          setMessage(
            'Registration successful! Please check your email to verify your account before logging in.'
          );
        }

        setPassword('');
        setConfirmPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-background">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <Droplets size={32} />
          </div>

          <h1>LabaGO</h1>
          <p>LAUNDRY PICK-UP & DELIVERY</p>
        </div>

        <div className="auth-heading">
          <h2>{isRegister ? 'Create your account' : 'Welcome back!'}</h2>

          <p>
            {isRegister
              ? 'Join LabaGO and make laundry easier.'
              : 'Sign in to manage your laundry orders.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <>
              <div className="auth-input-group">
                <label>Full Name</label>

                <div className="auth-input-wrapper">
                  <UserRound size={18} />

                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Phone Number</label>

                <div className="auth-input-wrapper">
                  <Phone size={18} />

                  <input
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </>
          )}

          <div className="auth-input-group">
            <label>Email Address</label>

            <div className="auth-input-wrapper">
              <Mail size={18} />

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label>Password</label>

            <div className="auth-input-wrapper">
              <Lock size={18} />

              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={8}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="auth-input-group">
              <label>Confirm Password</label>

              <div className="auth-input-wrapper">
                <Lock size={18} />

                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
          )}

          {error && <div className="auth-message error-message">{error}</div>}

          {message && (
            <div className="auth-message success-message">{message}</div>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : isRegister
              ? 'Create Account'
              : 'Sign In'}

            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}

          <button
            type="button"
            onClick={() => {
              setMode(isRegister ? 'login' : 'register');
              setError('');
              setMessage('');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>

        <p className="auth-footer">© 2026 LabaGO. All rights reserved.</p>
      </div>
    </div>
  );
}

export default AuthPage;
