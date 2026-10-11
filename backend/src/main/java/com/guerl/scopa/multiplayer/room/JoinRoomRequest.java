package com.guerl.scopa.multiplayer.room;

public record JoinRoomRequest(String displayName, String playerId, String sessionToken) {
}
