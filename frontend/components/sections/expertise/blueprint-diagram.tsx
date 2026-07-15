export function BlueprintDiagram() {
  return (
    <svg
      viewBox="0 0 400 260"
      className="h-full w-full text-primary/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="0.5" y="0.5" width="399" height="259" stroke="currentColor" strokeOpacity="0.15" />
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`v${i}`} x1={(i + 1) * 40} y1="0" x2={(i + 1) * 40} y2="260" strokeOpacity="0.06" />
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={(i + 1) * 40} x2="400" y2={(i + 1) * 40} strokeOpacity="0.06" />
      ))}

      <rect x="30" y="30" width="90" height="60" rx="2" strokeOpacity="0.8" />
      <text x="40" y="55" fontSize="8" fill="currentColor" stroke="none" opacity="0.8">
        API GATEWAY
      </text>
      <line x1="40" y1="65" x2="110" y2="65" strokeOpacity="0.4" />
      <line x1="40" y1="75" x2="90" y2="75" strokeOpacity="0.4" />

      <rect x="160" y="20" width="100" height="50" rx="2" strokeOpacity="0.8" />
      <text x="170" y="42" fontSize="8" fill="currentColor" stroke="none" opacity="0.8">
        LOAD BALANCER
      </text>
      <circle cx="290" cy="45" r="18" strokeOpacity="0.6" />
      <circle cx="290" cy="45" r="10" strokeOpacity="0.6" />

      <rect x="30" y="130" width="70" height="90" rx="2" strokeOpacity="0.7" />
      <text x="38" y="150" fontSize="8" fill="currentColor" stroke="none" opacity="0.7">
        NODE 01
      </text>
      <line x1="40" y1="160" x2="90" y2="160" strokeOpacity="0.3" />
      <line x1="40" y1="170" x2="80" y2="170" strokeOpacity="0.3" />
      <line x1="40" y1="180" x2="90" y2="180" strokeOpacity="0.3" />
      <line x1="40" y1="190" x2="70" y2="190" strokeOpacity="0.3" />

      <rect x="140" y="130" width="70" height="90" rx="2" strokeOpacity="0.7" />
      <text x="148" y="150" fontSize="8" fill="currentColor" stroke="none" opacity="0.7">
        NODE 02
      </text>
      <line x1="150" y1="160" x2="200" y2="160" strokeOpacity="0.3" />
      <line x1="150" y1="170" x2="190" y2="170" strokeOpacity="0.3" />
      <line x1="150" y1="180" x2="200" y2="180" strokeOpacity="0.3" />

      <rect x="250" y="120" width="120" height="100" rx="2" strokeOpacity="0.85" />
      <text x="260" y="140" fontSize="8" fill="currentColor" stroke="none" opacity="0.85">
        DATA CLUSTER
      </text>
      <rect x="262" y="150" width="35" height="20" strokeOpacity="0.5" />
      <rect x="305" y="150" width="35" height="20" strokeOpacity="0.5" />
      <rect x="262" y="178" width="35" height="20" strokeOpacity="0.5" />
      <rect x="305" y="178" width="35" height="20" strokeOpacity="0.5" />

      <line x1="120" y1="60" x2="160" y2="45" strokeOpacity="0.4" />
      <line x1="210" y1="45" x2="272" y2="45" strokeOpacity="0.4" />
      <line x1="65" y1="90" x2="65" y2="130" strokeOpacity="0.4" />
      <line x1="175" y1="70" x2="175" y2="130" strokeOpacity="0.4" />
      <line x1="290" y1="63" x2="290" y2="120" strokeOpacity="0.4" />
      <line x1="100" y1="175" x2="140" y2="175" strokeOpacity="0.4" />
      <line x1="210" y1="175" x2="250" y2="175" strokeOpacity="0.4" />

      <circle cx="120" cy="60" r="2" fill="currentColor" stroke="none" />
      <circle cx="65" cy="130" r="2" fill="currentColor" stroke="none" />
      <circle cx="175" cy="130" r="2" fill="currentColor" stroke="none" />
      <circle cx="290" cy="120" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
