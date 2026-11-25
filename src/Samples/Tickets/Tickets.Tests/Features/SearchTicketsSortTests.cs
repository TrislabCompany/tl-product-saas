using Trislab.Modules.Tickets.Contracts.Dtos;
using Trislab.Modules.Tickets.Domain;
using Trislab.Modules.Tickets.Features.v1.Tickets.SearchTickets;

namespace Tickets.Tests.Features;

/// <summary>
/// Ticket numbers are text (<c>TK-n</c>), so a plain text sort puts <c>TK-10</c> between <c>TK-1</c> and
/// <c>TK-2</c>. The number sort must follow the numbers.
/// </summary>
public sealed class SearchTicketsSortTests
{
    private static readonly string[] Numbers = ["TK-10", "TK-2", "TK-9", "TK-1", "TK-100"];

    [Fact]
    public void SortByNumber_Should_FollowTheNumbers_When_Ascending()
    {
        Sorted("asc").ShouldBe(["TK-1", "TK-2", "TK-9", "TK-10", "TK-100"]);
    }

    [Fact]
    public void SortByNumber_Should_FollowTheNumbers_When_Descending()
    {
        Sorted("desc").ShouldBe(["TK-100", "TK-10", "TK-9", "TK-2", "TK-1"]);
    }

    private static string[] Sorted(string direction) =>
        SearchTicketsQueryHandler
            .ApplySort(Numbers.Select(Ticket).AsQueryable(), "number", direction)
            .Select(t => t.Number)
            .ToArray();

    private static Ticket Ticket(string number) =>
        Trislab.Modules.Tickets.Domain.Ticket.Create(number, "title", null, TicketPriority.Medium, Guid.NewGuid(), null);
}
