# Voice IDs are macOS `say` system voice names (see `say -v ?` for the full
# list installed on this machine), not ElevenLabs voice IDs.
PRESET_VOICES = [
    {"id": "Samantha", "name": "Samantha (US)"},
    {"id": "Daniel", "name": "Daniel (UK)"},
    {"id": "Karen", "name": "Karen (Australian)"},
    {"id": "Moira", "name": "Moira (Irish)"},
]


def is_valid_voice_id(voice_id: str) -> bool:
    return any(voice["id"] == voice_id for voice in PRESET_VOICES)
