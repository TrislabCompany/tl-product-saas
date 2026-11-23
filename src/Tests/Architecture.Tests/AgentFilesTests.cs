using Shouldly;
using Xunit;

namespace Architecture.Tests;

/// <summary>
/// The AI agent files (AGENTS.md): every skill in .agents/skills has a pointer in .claude/skills
/// with the same front matter, so that Claude Code lists it, and every rule in .claude/rules is
/// scoped with <c>paths:</c>, so that it loads only for the files it is about.
/// </summary>
public class AgentFilesTests
{
    private static readonly string SolutionRoot = ModuleArchitectureTestsFixture.SolutionRoot;

    [Fact]
    public void Every_Skill_Has_A_Claude_Pointer_With_The_Same_Front_Matter()
    {
        string skills = Path.Combine(SolutionRoot, ".agents", "skills");
        string pointers = Path.Combine(SolutionRoot, ".claude", "skills");

        var skillNames = SkillNames(skills);
        var pointerNames = SkillNames(pointers);

        skillNames.Except(pointerNames).ShouldBeEmpty("Add a .claude/skills/<name>/SKILL.md pointer for these skills");
        pointerNames.Except(skillNames).ShouldBeEmpty("These pointers have no skill in .agents/skills");

        foreach (string name in skillNames)
        {
            string skill = FrontMatter(Path.Combine(skills, name, "SKILL.md"));
            string pointer = FrontMatter(Path.Combine(pointers, name, "SKILL.md"));
            pointer.ShouldBe(skill, $"The front matter of the pointer .claude/skills/{name} differs from its skill");
        }
    }

    [Fact]
    public void Every_Rule_Is_Scoped_By_Paths()
    {
        string rules = Path.Combine(SolutionRoot, ".claude", "rules");

        var unscoped = Directory.GetFiles(rules, "*.md", SearchOption.AllDirectories)
            .Where(f => !FrontMatter(f).Contains("\npaths:", StringComparison.Ordinal))
            .Select(f => Path.GetRelativePath(SolutionRoot, f))
            .ToList();

        unscoped.ShouldBeEmpty("A rule without paths: loads in every session; give it paths: front matter");
    }

    private static List<string> SkillNames(string root) =>
        Directory.Exists(root)
            ? Directory.GetDirectories(root)
                .Where(d => File.Exists(Path.Combine(d, "SKILL.md")))
                .Select(Path.GetFileName)
                .OfType<string>()
                .Order(StringComparer.Ordinal)
                .ToList()
            : [];

    private static string FrontMatter(string file)
    {
        string text = File.ReadAllText(file).Replace("\r\n", "\n", StringComparison.Ordinal);
        if (!text.StartsWith("---\n", StringComparison.Ordinal))
        {
            return string.Empty;
        }

        int end = text.IndexOf("\n---", 4, StringComparison.Ordinal);
        return end < 0 ? string.Empty : text[..end];
    }
}
