using Mediator;

namespace Trislab.Modules.Tickets.Contracts.v1.Tickets;

public sealed record DeleteTicketCommand(Guid TicketId) : ICommand<Unit>;
