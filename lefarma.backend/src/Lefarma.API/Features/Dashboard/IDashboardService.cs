using ErrorOr;
using Lefarma.API.Features.Dashboard.DTOs;

namespace Lefarma.API.Features.Dashboard
{
    public interface IDashboardService
    {
        Task<ErrorOr<DashboardStatsResponse>> GetStatsAsync();
    }
}
