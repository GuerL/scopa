package com.guerl.scopa.multiplayer.room;

public record RoomSessionResponse(
        String roomCode,
        String playerId,
        String sessionToken,
        RoomSnapshot room
) {
}
