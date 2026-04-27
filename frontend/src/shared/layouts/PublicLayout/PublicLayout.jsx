import React from 'react';
import WaveBackground from '../../components/WaveBackground/WaveBackground';
import logo from '../../../assets/JJ-FINAL-LOGO-PNG.png';

const PublicLayout = ({ children }) => {
  return (
    <div className="relative min-h-screen bg-[var(--bg)] custom-scrollbar overflow-y-auto flex flex-col">
      {/* Background decoration for a professional feel */}
      <WaveBackground />
      
      {/* Simple Header */}
      <header className="sticky top-0 z-10 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="JJ Studio" className="h-10 w-auto object-contain" />
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">JJ Studio</h1>
          </div>
          <div className="text-[var(--text-muted)] text-sm hidden sm:block font-medium">
            Secure Onboarding Portal
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative py-10 flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-10 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border)] mt-auto bg-[var(--surface)]/50">
        <p>© 2025 JJ Studio. All information is encrypted and secure.</p>
      </footer>
    </div>
  );
};

export default PublicLayout;
