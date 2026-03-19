f = r'C:\Users\PC\Proyectos\01-lefarma-project\lefarma.frontend\src\pages\catalogos\generales\TiposMedida\TiposMedidaList.tsx'
with open(f, 'r', encoding='utf-8') as fp:
    lines = fp.readlines()
print('Total lines:', len(lines))
with open(f, 'w', encoding='utf-8') as fp:
    fp.writelines(lines[:528])
print('Done. Written', 528, 'lines.')
