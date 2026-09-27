package com.guerl.scopa.multiplayer.room;

public record ReadyRequest(String playerId, String sessionToken, boolean ready) {
}
