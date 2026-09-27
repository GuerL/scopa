package com.guerl.scopa.multiplayer.room;

import com.guerl.scopa.multiplayer.player.PlayerSnapshot;

import java.time.Instant;
import java.util.List;

public record RoomSnapshot(
        String roomCode,
        String hostPlayerId,
        List<PlayerSnapshot> players,
        Instant createdAt,
        RoomStatus status
) {

    public static RoomSnapshot from(Room room) {
        return new RoomSnapshot(
                room.getRoomCode(),
                room.getHostPlayerId(),
                room.getPlayers().stream().map(PlayerSnapshot::from).toList(),
                room.getCreatedAt(),
                room.getStatus()
        );
    }
}
