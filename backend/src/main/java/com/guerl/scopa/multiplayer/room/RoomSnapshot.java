package com.guerl.scopa.multiplayer.room;

import com.guerl.scopa.game.ScopaGameSnapshot;
import com.guerl.scopa.game.ScopaRules;
import com.guerl.scopa.multiplayer.player.PlayerSnapshot;

import java.time.Instant;
import java.util.List;

public record RoomSnapshot(
        String roomCode,
        String hostPlayerId,
        List<PlayerSnapshot> players,
        Instant createdAt,
        RoomStatus status,
        ScopaGameSnapshot game
) {

    public static RoomSnapshot from(Room room) {
        return from(room, null, null);
    }

    public static RoomSnapshot from(Room room, String viewerPlayerId, ScopaRules rules) {
        return new RoomSnapshot(
                room.getRoomCode(),
                room.getHostPlayerId(),
                room.getPlayers().stream().map(PlayerSnapshot::from).toList(),
                room.getCreatedAt(),
                room.getStatus(),
                room.getGame() == null || viewerPlayerId == null || rules == null
                        ? null
                        : ScopaGameSnapshot.forPlayer(room.getGame(), viewerPlayerId, rules)
        );
    }
}
