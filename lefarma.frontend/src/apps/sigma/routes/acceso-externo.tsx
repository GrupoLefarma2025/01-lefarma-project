import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setVisitor, useSigmaAuth } from "@/apps/sigma/store/sigmaAuth";
import { post } from "@/apps/sigma/lib/httpClient";
import { ChevronLeft, Loader2 } from "lucide-react";

interface AccesoExternoResponse {
  success?: boolean;
  data?: {
    idUsuario?: number;
    nombreCompleto?: string;
    correo?: string;
    visitorToken?: string;
  };
  message?: string;
  error?: string;
}
export default function AccesoExterno() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSigmaAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Si ya está autenticado, redirigir al home
    if (isAuthenticated) {
      navigate("/SIGMA/home");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const nombreCompleto = formData.get("nombreCompleto") as string;
    const correo = formData.get("correo") as string;

    try {
      const response = await post<AccesoExternoResponse>(
        "/v2/documentos/acceso-externo",
        { nombreCompleto, correo }
      );

      const payload = response.data;
      if (response.success && payload?.visitorToken) {
        setVisitor({
          nombreCompleto: payload.nombreCompleto ?? nombreCompleto,
          correo: payload.correo ?? correo,
          visitorToken: payload.visitorToken,
        });
        // El visitante no tiene sesión de Lefarma: home está protegido. Su
        // destino útil es la validación pública del documento que trae el
        // enlace del correo (`?idDocumento=`).
        navigate("/SIGMA/documentos/validar-firma");
      } else {
        setError(
          response.message || response.error || "Error al crear acceso anónimo"
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con el servidor"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-center gap-3">
            <Link to="/SIGMA">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">Acceso Anónimo</CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-1">
                Acceso limitado sin credenciales de Active Directory
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {error && (
            <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-destructive/20 flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-destructive rounded-full mx-auto mt-1"></div>
              </div>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombreCompleto" className="text-sm font-medium">Nombre Completo</Label>
                <Input
                  id="nombreCompleto"
                  name="nombreCompleto"
                  type="text"
                  placeholder="Tu nombre completo"
                  required
                  autoFocus
                  disabled={loading}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="correo" className="text-sm font-medium">Correo Electrónico</Label>
                <Input
                  id="correo"
                  name="correo"
                  type="email"
                  placeholder="tu.correo@ejemplo.com"
                  required
                  disabled={loading}
                  className="h-10"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando acceso...
                  </>
                ) : (
                  "Acceder"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 pt-2 pb-4">
          <div className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              ¿Tienes una cuenta?{" "}
              <Link
                to="/SIGMA"
                className="text-primary hover:text-primary/80 font-medium"
              >
                Iniciar sesión normal
              </Link>
            </p>
          </div>
          
          <div className="text-xs text-center text-muted-foreground/70 pt-2 border-t border-border/50">
            <p>El acceso anónimo tiene permisos limitados</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
