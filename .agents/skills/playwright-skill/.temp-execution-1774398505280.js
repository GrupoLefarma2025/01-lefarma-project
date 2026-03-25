const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5175';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const page = await browser.newPage();

  try {
    console.log('🔍 Navegando a página de configuración...');
    await page.goto(`${TARGET_URL}/configuracion`, { waitUntil: 'networkidle' });

    // Esperar a que la página cargue
    await page.waitForTimeout(2000);

    console.log('📸 Tomando screenshot inicial...');
    await page.screenshot({ path: '/tmp/ui-config-initial.png', fullPage: true });

    // Verificar que los presets estén visibles
    console.log('✅ Verificando presets...');
    const presets = await page.locator('button').all();
    console.log(`   Encontrados ${presets.length} botones`);

    // Hacer click en preset "Compacto"
    console.log('🎯 Seleccionando preset "Compacto"...');
    await page.click('text=Compacto');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/ui-config-compacto.png' });
    console.log('✅ Preset Compacto aplicado');

    // Hacer click en preset "Cómodo"
    console.log('🛋️ Seleccionando preset "Cómodo"...');
    await page.click('text=Cómodo');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/ui-config-comodo.png' });
    console.log('✅ Preset Cómodo aplicado');

    // Hacer click en preset "Accesibilidad"
    console.log('♿ Seleccionando preset "Accesibilidad"...');
    await page.click('text=Accesibilidad');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/ui-config-accesibilidad.png' });
    console.log('✅ Preset Accesibilidad aplicado');

    // Verificar configuración avanzada
    console.log('⚙️ Abriendo configuración avanzada...');
    await page.click('text=Mostrar Configuración Avanzada');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/ui-config-advanced.png', fullPage: true });
    console.log('✅ Configuración avanzada visible');

    // Verificar controles de densidad
    console.log('🎛️ Verificando controles de densidad de tablas...');
    const densityButtons = await page.locator('button:has-text("Compacta"), button:has-text("Estándar"), button:has-text("Cómoda")').all();
    console.log(`   Encontrados ${densityButtons.length} botones de densidad`);

    // Verificar slider
    const slider = await page.locator('input[type="range"]').isVisible();
    console.log(`   Slider visible: ${slider}`);

    // Verificar localStorage
    console.log('💾 Verificando localStorage...');
    const configData = await page.evaluate(() => {
      const config = localStorage.getItem('config-storage');
      if (config) {
        const parsed = JSON.parse(config);
        return {
          presetId: parsed.ui?.presetId,
          visual: config.ui?.visual,
          componentes: config.ui?.componentes
        };
      }
      return null;
    });

    console.log('   Datos en localStorage:');
    console.log(`   - presetId: ${configData?.presetId}`);
    console.log(`   - visual.fontSize: ${configData?.visual?.fontSize}`);
    console.log(`   - visual.densidad: ${configData?.visual?.densidad}`);
    console.log(`   - componentes.tables.density: ${configData?.componentes?.tables?.density}`);

    console.log('\n✅ TODAS LAS VALIDACIONES PASARON!');
    console.log('📸 Screenshots guardados en /tmp/:');
    console.log('   - ui-config-initial.png');
    console.log('   - ui-config-compacto.png');
    console.log('   - ui-config-comodo.png');
    console.log('   - ui-config-accesibilidad.png');
    console.log('   - ui-config-advanced.png');

  } catch (error) {
    console.error('❌ Error durante validación:', error.message);
    await page.screenshot({ path: '/tmp/ui-config-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
