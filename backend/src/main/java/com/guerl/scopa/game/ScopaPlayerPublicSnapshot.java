package com.guerl.scopa.game;

public record ScopaPlayerPublicSnapshot(
        String playerId,
        int handCount,
        int capturedCount,
        int scopasThisRound,
        int roundPoints,
        int totalPoints,
        boolean roundAcknowledged,
        boolean rematchRequested
) {

    public static ScopaPlayerPublicSnapshot from(ScopaPlayerState player) {
        return new ScopaPlayerPublicSnapshot(
                player.getPlayerId(),
                player.getHand().size(),
                player.getCapturedCards().size(),
                player.getScopasThisRound(),
                player.getRoundPoints(),
                player.getTotalPoints(),
                player.isRoundAcknowledged(),
                player.isRematchRequested()
        );
    }
}
