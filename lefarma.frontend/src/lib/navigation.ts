import type { NavigateFunction } from 'react-router-dom';

let navigate: NavigateFunction | null = null;

export function setNavigate(n: NavigateFunction) {
  navigate = n;
}

export function navigateTo(path: string) {
  if (navigate) {
    navigate(path);
    return;
  }
  window.location.href = path;
}
