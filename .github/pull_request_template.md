## What and why

<!-- What this PR changes, and why. -->

## Checklist

- [ ] `dotnet test src/App.slnx` passes locally, and `npm run build` in each changed client
- [ ] Is the migration backward compatible? The previous revision of the API keeps serving on the migrated database until the new one is ready, or there is no migration
- [ ] The API, `.Contracts` and integration events only gained fields, or the breaking change is a new version
- [ ] `platform.yaml` is unchanged, or the change is described above and stays within the stamp's caps
- [ ] Screenshots of the changed pages are attached, or nothing visible changed
