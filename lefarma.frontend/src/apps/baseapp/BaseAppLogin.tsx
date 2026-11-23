import { useSearchParams } from 'react-router-dom';
import { MultiStepLogin } from '@/components/baseapp/MultiStepLogin';

const DEFAULT_REDIRECT = '/hub';

function resolveSafeReturn(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (/^https?:/i.test(value)) return null;
  return value;
}

export default function BaseAppLogin() {
  const [searchParams] = useSearchParams();
  const redirectTo = resolveSafeReturn(searchParams.get('return')) ?? DEFAULT_REDIRECT;

  return <MultiStepLogin redirectTo={redirectTo} />;
}
