import { FirmaUploadCard } from '@/components/common/FirmaUploadCard';

export function Profile() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      <FirmaUploadCard />
      <p className="text-sm text-muted-foreground">
        Gestiona tu firma digital. Más opciones de perfil se integrarán en cambios posteriores.
      </p>
    </div>
  );
}
