using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class HospitalExtensionRepository : IHospitalExtensionRepository
{
    private readonly ApplicationDbContext _context;

    public HospitalExtensionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<HospitalExtension>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.HospitalesExtension
            .Where(h => h.Activo)
            .ToListAsync(cancellationToken);
    }

    public async Task<HospitalExtension?> GetByHospitalIdAsync(
        int idHospital,
        CancellationToken cancellationToken = default)
    {
        return await _context.HospitalesExtension
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.IdHospital == idHospital && h.Activo, cancellationToken);
    }

    public async Task<List<HospitalExtension>> GetByHospitalIdsAsync(
        IEnumerable<int> idsHospital,
        CancellationToken cancellationToken = default)
    {
        var ids = idsHospital.Distinct().ToList();
        if (ids.Count == 0) return new List<HospitalExtension>();

        return await _context.HospitalesExtension
            .AsNoTracking()
            .Where(h => ids.Contains(h.IdHospital) && h.Activo)
            .ToListAsync(cancellationToken);
    }

    public async Task<HospitalExtension> CreateAsync(
        HospitalExtension extension,
        CancellationToken cancellationToken = default)
    {
        extension.Activo = true;
        extension.FechaCreacion = DateTime.UtcNow;
        extension.FechaModificacion = DateTime.UtcNow;

        _context.HospitalesExtension.Add(extension);
        await _context.SaveChangesAsync(cancellationToken);

        return extension;
    }

    public async Task UpdateAsync(
        HospitalExtension extension,
        CancellationToken cancellationToken = default)
    {
        extension.FechaModificacion = DateTime.UtcNow;

        _context.HospitalesExtension.Update(extension);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
