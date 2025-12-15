# Queer Augsburg Web

## Quiz Feature

Jeopardy-style quiz board for events. Code-split and only loaded when accessed.

- `/quiz/control` - Host view for managing questions and awarding points
- `/quiz/board` - Display view for audience (open in separate window/projector)

State syncs across tabs via localStorage. Export/import game data as JSON.
