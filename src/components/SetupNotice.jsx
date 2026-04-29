import { AlertTriangle } from 'lucide-react';

export default function SetupNotice() {
  return (
    <section className="setup-notice">
      <div className="setup-notice__card">
        <AlertTriangle size={28} />
        <h1>Supabase is nog niet gekoppeld</h1>
        <p>
          Vul <code>.env</code> in met <code>VITE_SUPABASE_URL</code> en <code>VITE_SUPABASE_ANON_KEY</code>, en voer daarna{' '}
          <code>supabase/setup.sql</code> uit in je project.
        </p>
      </div>
    </section>
  );
}
