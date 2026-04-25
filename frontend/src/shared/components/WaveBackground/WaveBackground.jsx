import React from 'react';

const WaveBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg)]">
      {/* Background SVG Waves */}
      <svg
        className="absolute top-0 left-0 w-full h-full opacity-40"
        viewBox="0 0 1440 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M0 100C300 200 600 0 900 100C1200 200 1500 0 1800 100V800H0V100Z"
          fill="url(#wave-gradient)"
        />
        <defs>
          <linearGradient id="wave-gradient" x1="720" y1="0" x2="720" y2="800" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--primary)" stopOpacity="0.1" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Additional subtle decorative elements */}
      <div className="absolute top-[20%] left-[-10%] w-[40%] h-[40%] bg-[var(--primary)] opacity-[0.03] blur-[100px] rounded-full" />
      <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-[var(--primary)] opacity-[0.05] blur-[120px] rounded-full" />
    </div>
  );
};

export default WaveBackground;
