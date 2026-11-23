using System.Runtime.CompilerServices;
using Trislab.Framework.Web.Modules;

[assembly: TrislabModule(typeof(Trislab.Modules.Chat.ChatModule), 800)]
[assembly: InternalsVisibleTo("Chat.Tests")]
[assembly: InternalsVisibleTo("Integration.Tests")]
