import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const protocol =
  process.env.NODE_ENV === 'production' ? 'https' : 'http';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
