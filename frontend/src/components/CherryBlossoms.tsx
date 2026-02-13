import { useEffect, useState } from 'react';

interface Petal {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  opacity: number;
  rotation: number;
}

export const CherryBlossoms: React.FC = () => {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    const initial: Petal[] = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 4 + Math.random() * 6,
      size: 8 + Math.random() * 14,
      drift: -30 + Math.random() * 60,
      opacity: 0.4 + Math.random() * 0.5,
      rotation: Math.random() * 360,
    }));
    setPetals(initial);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <style>{`
        @keyframes petalFall {
          0% {
            transform: translateY(-5vh) translateX(0px) rotate(var(--rot));
            opacity: 0;
          }
          10% {
            opacity: var(--op);
          }
          50% {
            transform: translateY(50vh) translateX(calc(var(--drift) * 1px)) rotate(calc(var(--rot) + 180deg));
          }
          90% {
            opacity: var(--op);
          }
          100% {
            transform: translateY(105vh) translateX(calc(var(--drift) * 0.5px)) rotate(calc(var(--rot) + 360deg));
            opacity: 0;
          }
        }
      `}</style>
      {petals.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size,
            ['--rot' as any]: `${p.rotation}deg`,
            ['--drift' as any]: p.drift,
            ['--op' as any]: p.opacity,
            animation: `petalFall ${p.duration}s ease-in-out ${p.delay}s infinite`,
            opacity: 0,
          }}
        >
          <svg viewBox="0 0 24 24" width={p.size} height={p.size}>
            <path
              d="M12 2C12 2 7 7 7 12C7 14.5 9 16 12 16C15 16 17 14.5 17 12C17 7 12 2 12 2Z"
              fill="#FFB7C5"
              opacity="0.9"
            />
            <path
              d="M12 2C12 2 7 7 7 12C7 14.5 9 16 12 16"
              fill="#FF9BB3"
              opacity="0.5"
            />
            <circle cx="12" cy="12" r="1.5" fill="#FFD4E0" opacity="0.8" />
          </svg>
        </div>
      ))}
    </div>
  );
};
