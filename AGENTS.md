# AGENTS.md

## Directives
Adhere to the rules defined in the [rules directory](./.rules/):
- [General Rules](./.rules/general.md) (Logging & Language)
- [TypeScript Rules](./.rules/typescript.md)
- [React Rules](./.rules/react.md)
- [Modal Styling Rules](./.rules/modals.md) (Modal component structure and styling)
- [Testing Conventions](./.rules/testing.md) (Test file organization and structure)

## Project Log
- 2026-02-04: Added AI model selector with vision detection to chat panel. Created aiModel utility with modelSupportsVision, parseModelString, and formatModelString functions. Added 31 comprehensive unit tests. Selector positioned inline before Send button, opens upward.
- 2026-02-04: Added multimodal support (images) to AI chat panel with MessageContentPart enum, image upload UI, vision model detection, and 5MB size validation. Created image utility with tests (18 tests). Renamed dumpUtils to dump following conventions.
- 2026-02-04: Added AI chat side panel with schema-aware context, new chat_ai_assist backend command, and i18n strings.
- 2026-02-04: Updated chat input to send on Enter and adjusted tips copy.
- 2026-02-04: Added configurable chat prompt with settings UI and backend storage.
