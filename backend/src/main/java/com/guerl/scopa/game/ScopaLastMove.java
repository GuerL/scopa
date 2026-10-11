package com.guerl.scopa.game;

import java.util.List;

/** Public cards from a successfully committed move, never a player's remaining hand. */
public record ScopaLastMove(String playerId, String playerDisplayName, ScopaCard playedCard,
                            List<ScopaCard> capturedCards, boolean scopa, long sequence) {
    public ScopaLastMove {
        capturedCards = List.copyOf(capturedCards);
    }
}
