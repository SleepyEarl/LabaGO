
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import AuthPage from './AuthPage';
import App from './App';
import AdminDashboard from './AdminDashboard.jsx';

function AppWithAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        setProfile(null);
        setRole(null);
        setProfileError('');
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setProfileError(error.message);
      }

      setSession(data?.session ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      if (!session?.user) {
        setProfile(null);
        setRole(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setProfileError('');

      const userId = session.user.id;

      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, phone, avatar_url')
          .eq('id', userId)
          .single(),

        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .single(),
      ]);

      if (!mounted) return;

      if (profileResult.error || roleResult.error) {
        setProfileError(
          profileResult.error?.message ||
          roleResult.error?.message ||
          'Unable to load your account.'
        );

        setProfile(null);
        setRole(null);
      } else {
        setProfile(profileResult.data);
        setRole(roleResult.data.role);
      }

      setProfileLoading(false);
    }

    loadAccount();

    return () => {
      mounted = false;
    };
  }, [session]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setProfileError(error.message);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner" />
        <h2>LabaGO</h2>
        <p>Loading your account...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (profileError || !profile || !role) {
    return (
      <div className="auth-loading">
        <h2>Unable to load account</h2>
        <p>{profileError || 'Your account information is incomplete.'}</p>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
    );
  }

  if (role === 'admin') {
    return (
      <AdminDashboard
        user={session.user}
        profile={profile}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <App
      user={session.user}
      profile={profile}
      role={role}
      onSignOut={handleSignOut}
    />
  );
}

export default AppWithAuth;
