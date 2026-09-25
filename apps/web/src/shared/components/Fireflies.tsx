import { cn } from '@/shared/utils/cn';

export interface FireflyItem {
  top: string;
  left: string;
  size?: string;
  color?: 'cyan' | 'gold';
  anim?: '1' | '2' | '3' | '4';
  delay?: string;
}

interface FirefliesProps {
  items: FireflyItem[];
  className?: string;
}

export function Fireflies({ items, className }: FirefliesProps) {
  return (
    <div
      className={cn('absolute inset-0 pointer-events-none overflow-visible select-none z-0', className)}
      aria-hidden="true"
    >
      {items.map((f, i) => {
        const sizeClass = f.size || (i % 2 === 0 ? 'w-2 h-2' : 'w-1.5 h-1.5');
        const colorClass = f.color === 'gold' ? 'firefly-gold' : 'firefly-cyan';
        const animClass = f.anim ? `anim-firefly-${f.anim}` : `anim-firefly-${(i % 4) + 1}`;
        return (
          <span
            key={i}
            className={cn('absolute rounded-full', sizeClass, colorClass, animClass)}
            style={{
              top: f.top,
              left: f.left,
              animationDelay: f.delay || `${(i * 0.7).toFixed(1)}s`,
            }}
          />
        );
      })}
    </div>
  );
}
