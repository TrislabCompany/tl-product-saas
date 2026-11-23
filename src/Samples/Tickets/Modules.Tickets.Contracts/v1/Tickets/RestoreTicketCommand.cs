using Mediator;

namespace Trislab.Modules.Tickets.Contracts.v1.Tickets;

public sealed record RestoreTicketCommand(Guid TicketId) : ICommand<Guid>;
