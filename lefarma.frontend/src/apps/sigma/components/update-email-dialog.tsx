import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSigmaAuth, sigmaAuth } from "@/apps/sigma/store/sigmaAuth";
import { getUserId } from "@/apps/sigma/lib/userId";
import { API_BASE_URL } from "@/apps/sigma/lib/httpClient";
import { Loader2 } from "lucide-react";

interface UpdateEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export function UpdateEmailDialog({
  open,
  onOpenChange,
  userId,
}: UpdateEmailDialogProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { updateUser } = useSigmaAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Por favor ingresa un correo electrónico válido");
      setLoading(false);
      return;
    }

    try {
      const userIdToUpdate = userId ?? getUserId();

      if (!userIdToUpdate) {
        setError("No se pudo identificar el usuario");
        setLoading(false);
        return;
      }

      const requestBody = { "correo":email };

      const response = await fetch(
        `${API_BASE_URL}/admin/users/${userIdToUpdate}/email`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sigmaAuth.getToken() ?? ""}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        // Actualizar el email en el store de autenticación (zustand)
        updateUser({ correo: email });

        setSuccess(true);
        setError("");

        // Cerrar el diálogo después de 1.5 segundos
        setTimeout(() => {
          onOpenChange(false);
          setEmail("");
          setSuccess(false);
        }, 1500);
      } else {
        setError(data.message || "Error al actualizar el correo electrónico");
      }
    } catch (err) {
      console.error("Error al actualizar email:", err);
      setError("Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail("");
      setError("");
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={!loading}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Actualizar correo electrónico</DialogTitle>
            <DialogDescription>
              Tu cuenta no tiene un correo electrónico registrado. Por favor
              ingresa uno para completar tu perfil.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {error && (
              <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                Correo electrónico actualizado exitosamente
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu.correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={loading || success}
              />
              <p className="text-xs text-muted-foreground">
                Ingresa un correo electrónico válido que uses regularmente
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading || success}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || success || !email}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Actualizar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
