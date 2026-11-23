using Trislab.Modules.Tickets.Contracts.Dtos;
using Mediator;

namespace Trislab.Modules.Tickets.Contracts.v1.Tickets;

public sealed record GetTicketByIdQuery(Guid TicketId) : IQuery<TicketDto>;
