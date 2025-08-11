"use client";

import { cn } from '@/lib/utils';
import { Zap, Wrench, FlaskConical, Rocket, Layers } from 'lucide-react';

export function EnvLogo({ envId, size = 18, className }: { envId?: string; size?: number; className?: string }) {
  const iconSize = Math.max(10, Math.round(size * 0.6));

  let Icon: React.ComponentType<any> = Zap;
  let gradient = 'from-amber-400 to-orange-500';

  switch (envId) {
    case 'env_dev':
      Icon = Wrench;
      gradient = 'from-amber-300 to-orange-400';
      break;
    case 'env_test':
      Icon = FlaskConical;
      gradient = 'from-yellow-300 to-amber-500';
      break;
    case 'env_staging':
      Icon = Layers;
      gradient = 'from-orange-500 to-amber-600';
      break;
    case 'env_uat':
      Icon = Rocket;
      gradient = 'from-amber-400 to-yellow-600';
      break;
    default:
      Icon = Zap;
      gradient = 'from-amber-400 to-orange-500';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-gradient-to-br shadow-sm',
        gradient,
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={iconSize} strokeWidth={3} className="text-white" />
    </span>
  );
} 