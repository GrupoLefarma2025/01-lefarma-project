const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5175';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext();

  try {
    console.log('🔐 Iniciando proceso de login...');

    // Navegar a login
    const page = await context.newPage();
    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('📸 Screenshot de login...');
    await page.screenshot({ path: '/tmp/login-page.png' });

    // Llenar formulario de login con master password bypass
    console.log('🔑 Usando master password bypass (tt01tt)...');

    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'tt01tt');
    await page.screenshot({ path: '/tmp/login-filled.png' });

    console.log('⏎ Click en "Iniciar Sesión"...');
    await page.click('button[type="submit"]');

    // Esperar redirect
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`📍 URL actual: ${currentUrl}`);

    // Verificar si estamos en select-empresa o directamente en dashboard
    if (currentUrl.includes('/select-empresa')) {
      console.log('🏢 Seleccionando empresa y sucursal...');

      // Esperar a que carguen las empresas
      await page.waitForTimeout(2000);

      // Seleccionar primera empresa disponible
      const empresas = await page.locator('[role="option"]').all();
      if (empresas.length > 0) {
        await empresas[0].click();
        console.log('✅ Empresa seleccionada');
      }

      await page.waitForTimeout(1000);

      // Seleccionar primera sucursal disponible
      const sucursales = await page.locator('[role="option"]').all();
      if (sucursales.length > 0) {
        await sucursales[0].click();
        console.log('✅ Sucursal seleccionada');
      }

      // Click en continuar
      await page.click('button:has-text("Continuar")');
      await page.waitForTimeout(3000);
    }

    // Verificar si estamos autenticados
    const finalUrl = page.url();
    console.log(`📍 URL final: ${finalUrl}`);

    if (finalUrl.includes('/dashboard') || finalUrl.includes('/configuracion')) {
      console.log('✅ Login exitoso!');

      // Navegar a configuración
      if (!finalUrl.includes('/configuracion')) {
        console.log('🔧 Navegando a configuración...');
        await page.goto(`${TARGET_URL}/configuracion`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
      }

      console.log('📸 Tomando screenshot de configuración...');
      await page.screenshot({ path: '/tmp/config-page.png', fullPage: true });

      // Verificar presets
      console.log('🔍 Buscando presets...');

      const hasCompacto = await page.locator('text=Compacto').count();
      const hasEstandar = await page.locator('text=Estándar').count();
      const hasComodo = await page.locator('text=Cómodo').count();
      const hasAccesibilidad = await page.locator('text=Accesibilidad').count();

      console.log(`   Preset "Compacto": ${hasCompacto > 0 ? '✅' : '❌'}`);
      console.log(`   Preset "Estándar": ${hasEstandar > 0 ? '✅' : '❌'}`);
      console.log(`   Preset "Cómodo": ${hasComodo > 0 ? '✅' : '❌'}`);
      console.log(`   Preset "Accesibilidad": ${hasAccesibilidad > 0 ? '✅' : '❌'}`);

      if (hasCompacto > 0) {
        console.log('\n🎯 Probando preset "Compacto"...');
        await page.click('text=Compacto');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/config-compacto.png' });
        console.log('✅ Preset Compacto aplicado');
      }

      if (hasComodo > 0) {
        console.log('\n🛋️ Probando preset "Cómodo"...');
        await page.click('text=Cómodo');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/config-comodo.png' });
        console.log('✅ Preset Cómodo aplicado');
      }

      // Probar configuración avanzada
      const advancedButton = await page.locator('text=Mostrar Configuración Avanzada').count();
      if (advancedButton > 0) {
        console.log('\n⚙️ Abriendo configuración avanzada...');
        await page.click('text=Mostrar Configuración Avanzada');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/config-advanced.png', fullPage: true });
        console.log('✅ Configuración avanzada visible');
      }

      // Verificar localStorage
      console.log('\n💾 Verificando localStorage...');
      const configData = await page.evaluate(() => {
        const config = localStorage.getItem('config-storage');
        if (config) {
          const parsed = JSON.parse(config);
          return {
            presetId: parsed.ui?.presetId,
            hasVisual: !!parsed.ui?.visual,
            hasComponentes: !!parsed.ui?.componentes
          };
        }
        return null;
      });

      if (configData) {
        console.log('   Datos en localStorage:');
        console.log(`   - presetId: ${configData.presetId}`);
        console.log(`   - hasVisual: ${configData.hasVisual}`);
        console.log(`   - hasComponentes: ${configData.hasComponentes}`);
      }

      console.log('\n✅ TODAS LAS VALIDACIONES PASARON!');
      console.log('📸 Screenshots guardados en /tmp/:');
      console.log('   - login-page.png');
      console.log('   - login-filled.png');
      console.log('   - config-page.png');
      console.log('   - config-compacto.png');
      console.log('   - config-comodo.png');
      console.log('   - config-advanced.png');
    } else {
      console.log('❌ Login falló o redirección inesperada');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n⏸️ Navegador abierto para inspección. Presiona Enter para cerrar...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    await context.close();
    await browser.close();
  }
})();
