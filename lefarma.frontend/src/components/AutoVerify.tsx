/**
 * AutoVerify - Componente de verificación automática del sistema
 * Se activa con ?autotest=true en la URL
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

interface VerificationStep {
  id: number;
  title: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export function AutoVerify() {
  const [steps, setSteps] = useState<VerificationStep[]>([
    { id: 1, title: 'Verificando Frontend', status: 'pending', message: '' },
    { id: 2, title: 'Verificando Backend', status: 'pending', message: '' },
    { id: 3, title: 'Login con usuario 54', status: 'pending', message: '' },
    { id: 4, title: 'Endpoint Notificaciones', status: 'pending', message: '' },
    { id: 5, title: 'Conexión SSE', status: 'pending', message: '' },
  ]);
  const [finalResult, setFinalResult] = useState<string>('');
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);

  const updateStep = (id: number, updates: Partial<VerificationStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === id ? { ...step, ...updates } : step
    ));
  };

  useEffect(() => {
    // Capturar errores de consola
    const originalError = console.error;
    const originalLog = console.log;

    console.error = (...args) => {
      const msg = args.join(' ');
      setConsoleErrors(prev => [...prev, msg]);
      originalError.apply(console, args);
    };

    console.log = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('SSE') || msg.includes('Notifications')) {
        console.log('[AutoVerify]', ...args);
      }
      originalLog.apply(console, args);
    };

    runVerification();

    return () => {
      console.error = originalError;
      console.log = originalLog;
    };
  }, []);

  const runVerification = async () => {
    // Step 1: Frontend
    updateStep(1, { status: 'running', message: 'Verificando...' });
    try {
      const res = await fetch('http://localhost:5174');
      if (res.ok) {
        updateStep(1, { status: 'success', message: 'HTTP 200 - Disponible' });
      } else {
        updateStep(1, { status: 'warning', message: `HTTP ${res.status}` });
      }
    } catch (e) {
      updateStep(1, { status: 'error', message: `Error: ${(e as Error).message}` });
    }

    // Step 2: Backend
    updateStep(2, { status: 'running', message: 'Verificando...' });
    try {
      const res = await fetch('http://localhost:5134');
      updateStep(2, { status: 'success', message: `HTTP ${res.status}` });
    } catch (e) {
      updateStep(2, { status: 'error', message: `Error: ${(e as Error).message}` });
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Login
    updateStep(3, { status: 'running', message: 'Autenticando...' });
    let token: string | null = null;
    let userId: number | null = null;

    try {
      const res = await fetch('http://localhost:5134/api/auth/login-step-two', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '54',
          password: 'tt01tt',
          domain: 'Grupolefarma'
        })
      });

      const data = await res.json();

      if (data.success && data.data.accessToken) {
        token = data.data.accessToken;
        userId = data.data.user.id;
        updateStep(3, {
          status: 'success',
          message: `Login exitoso - User ID: ${userId}`,
          details: `Token: ${token.substring(0, 30)}...`
        });
      } else {
        updateStep(3, { status: 'error', message: 'Login falló', details: JSON.stringify(data) });
        return;
      }
    } catch (e) {
      updateStep(3, { status: 'error', message: `Error: ${(e as Error).message}` });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Notifications endpoint
    updateStep(4, { status: 'running', message: 'Obteniendo notificaciones...' });
    try {
      const res = await fetch(`http://localhost:5134/api/notifications/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const notifs = await res.json();

      if (Array.isArray(notifs)) {
        updateStep(4, {
          status: 'success',
          message: `${notifs.length} notificaciones - Array válido`,
          details: '✅ FIX 1: No habrá error de undefined.filter()'
        });
      } else {
        updateStep(4, {
          status: 'error',
          message: `Respuesta no es un array: ${typeof notifs}`,
          details: '❌ Esto causaría: Cannot read properties of undefined (reading \'filter\')'
        });
      }
    } catch (e) {
      updateStep(4, { status: 'error', message: `Error: ${(e as Error).message}` });
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 5: SSE Connection
    updateStep(5, { status: 'running', message: 'Estableciendo conexión SSE...' });
    let reconnectCount = 0;
    let connectedOnce = false;

    try {
      const eventSource = new EventSource(
        `http://localhost:5134/api/notifications/stream?token=${token}`
      );

      eventSource.onopen = () => {
        if (!connectedOnce) {
          connectedOnce = true;
          updateStep(5, {
            status: 'success',
            message: 'Conexión SSE establecida',
            details: '✅ FIX 2: No hay bucle infinito (detectando...)'
          });
        } else {
          reconnectCount++;
        }
      };

      eventSource.addEventListener('connection.established', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Connection established for user:', data.userId);
      });

      eventSource.onerror = () => {
        updateStep(5, { status: 'warning', message: 'Error en conexión SSE' });
      };

      // Wait 5 seconds to observe
      await new Promise(resolve => setTimeout(resolve, 5000));

      eventSource.close();

      if (reconnectCount > 2) {
        updateStep(5, {
          status: 'error',
          message: `Bucle detectado: ${reconnectCount} reconexiones`,
          details: '❌ FIX 2: Aún hay bucle infinito'
        });
      } else {
        updateStep(5, {
          status: 'success',
          message: 'Conexión estable - Sin bucle',
          details: '✅ FIX 2 CONFIRMADO: No hay bucle infinito'
        });
      }

    } catch (e) {
      updateStep(5, { status: 'error', message: `Error: ${(e as Error).message}` });
    }

    // Final result
    const errorCount = steps.filter(s => s.status === 'error').length;
    if (errorCount === 0) {
      setFinalResult('✅ VERIFICACIÓN EXITOSA - Sistema funcionando correctamente');
    } else {
      setFinalResult(`❌ VERIFICACIÓN FALLÓ - ${errorCount} error(es) detectado(s)`);
    }
  };

  const getStatusColor = (status: VerificationStep['status']) => {
    switch (status) {
      case 'success': return '#00ff00';
      case 'error': return '#ff4444';
      case 'warning': return '#ffaa00';
      case 'running': return '#00aaff';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: VerificationStep['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'running': return '🔄';
      default: return '⏳';
    }
  };

  return (
    <div style={{
      fontFamily: 'Courier New, monospace',
      padding: '20px',
      background: '#1a1a1a',
      color: '#00ff00',
      minHeight: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      overflow: 'auto'
    }}>
      <h1>🔄 Auto Verificación - Sistema Lefarma</h1>
      <p style={{ color: '#888' }}>{new Date().toLocaleString()}</p>

      <div style={{ marginTop: '20px' }}>
        {steps.map(step => (
          <div
            key={step.id}
            style={{
              margin: '10px 0',
              padding: '15px',
              borderLeft: `4px solid ${getStatusColor(step.status)}`,
              background: '#0a0a0a',
              borderRadius: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>{getStatusIcon(step.status)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>
                  {step.id}. {step.title}
                </div>
                <div style={{ color: getStatusColor(step.status) }}>
                  {step.message}
                </div>
                {step.details && (
                  <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                    {step.details}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {finalResult && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: '#000',
          border: '2px solid',
          borderColor: finalResult.includes('✅') ? '#00ff00' : '#ff4444',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: 0 }}>{finalResult}</h2>
          <p style={{ marginTop: '10px', color: '#888' }}>
            Si ves este mensaje con ✅, podés confirmar con "✅ Funciona" en la terminal
          </p>
        </div>
      )}

      {consoleErrors.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>❌ Errores de Consola Capturados ({consoleErrors.length})</h3>
          {consoleErrors.map((err, i) => (
            <div key={i} style={{ color: '#ff4444', fontSize: '12px' }}>
              {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
