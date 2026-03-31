using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces;

{
    public interface IComprobacionRepository : IBaseRepository<Comprobacion>
    {
        Task<Comprobacion?> GetByIdAsync(int id);
    {
        Task<ICollection<Comprobacion>> GetByOrdenAsync(int idOrden);
    {
        Task<Comprobacion?> GetByUuidAsync(string uuid);
    {
        Task<Comprobacion> AddAsync(Comprobacion comprobacion);
    }
}
