import type { NavigateFunction } from 'react-router-dom';

let navigate: NavigateFunction | null = null;

export function setNavigate(n: NavigateFunction): void {
  navigate = n;
}

export function navigateTo(path: string): void {
  if (navigate) {
    navigate(path);
    return;
  }
  window.location.href = path;
}
