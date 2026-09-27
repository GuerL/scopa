package com.guerl.scopa.multiplayer.player;

public record PlayerSnapshot(
        String playerId,
        String displayName,
        boolean host,
        boolean ready,
        boolean connected
) {

    public static PlayerSnapshot from(Player player) {
        return new PlayerSnapshot(
                player.getPlayerId(),
                player.getDisplayName(),
                player.isHost(),
                player.isReady(),
                player.isConnected()
        );
    }
}
