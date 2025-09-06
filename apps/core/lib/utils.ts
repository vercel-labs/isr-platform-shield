import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getProtocol, getRootDomain } from '@platform/config';

export const protocol = getProtocol();
export const rootDomain = getRootDomain();

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
