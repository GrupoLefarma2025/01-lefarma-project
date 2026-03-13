import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Shield, Package, BarChart3, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user, empresa, sucursal } = useAuthStore();

  const stats = [
    {
      title: 'Total Empresas',
      value: '5',
      icon: Building2,
      change: '+2.5%',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Usuarios Activos',
      value: '48',
      icon: Users,
      change: '+12.3%',
      color: 'text-green-600',
      bgColor: 'bg-green-600/10',
    },
    {
      title: 'Roles Configurados',
      value: '8',
      icon: Shield,
      change: '0%',
      color: 'text-purple-600',
      bgColor: 'bg-purple-600/10',
    },
    {
      title: 'Productos',
      value: '1,234',
      icon: Package,
      change: '+8.1%',
      color: 'text-orange-600',
      bgColor: 'bg-orange-600/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido, {user?.nombre || user?.username}
        </p>
        {empresa && sucursal && (
          <p className="text-sm text-muted-foreground mt-2">
            {empresa.nombre} - {sucursal.nombre}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-full`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className={stat.change.startsWith('+') ? 'text-green-600' : 'text-muted-foreground'}>
                    {stat.change}
                  </span>{' '}
                  vs mes anterior
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
            <CardDescription>Últimas acciones en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="bg-primary/20 p-2 rounded-full">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Nuevo usuario registrado</p>
                  <p className="text-xs text-muted-foreground">Hace 2 horas</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="bg-green-600/20 p-2 rounded-full">
                  <Shield className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Rol actualizado</p>
                  <p className="text-xs text-muted-foreground">Hace 5 horas</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="bg-purple-600/20 p-2 rounded-full">
                  <Building2 className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Nueva empresa registrada</p>
                  <p className="text-xs text-muted-foreground">Hace 1 día</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Estadísticas Rápidas
            </CardTitle>
            <CardDescription>Resumen del mes actual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">Ventas del Mes</p>
                  <p className="text-2xl font-bold text-primary">$45,231</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>

              <div className="flex items-center justify-between p-3 bg-green-600/10 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">Pedidos Completados</p>
                  <p className="text-2xl font-bold text-green-600">156</p>
                </div>
                <Package className="h-8 w-8 text-green-600" />
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-600/10 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">Clientes Nuevos</p>
                  <p className="text-2xl font-bold text-purple-600">23</p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
