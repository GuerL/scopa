package com.guerl.scopa.game;

import java.util.List;

public record ScopaGameSnapshot(
        ScopaGameStatus status,
        int roundNumber,
        List<ScopaCard> tableCards,
        List<ScopaCard> hand,
        List<ScopaCaptureOption> possibleCaptures,
        List<ScopaPlayerPublicSnapshot> players,
        String currentPlayerId,
        String startingPlayerId,
        String lastCapturingPlayerId,
        String winnerPlayerId,
        int deckRemaining,
        ScopaRoundResult roundResult,
        String lastEvent
) {

    public static ScopaGameSnapshot forPlayer(ScopaGameState game, String viewerPlayerId, ScopaRules rules) {
        ScopaPlayerState viewer = game.getPlayers().get(viewerPlayerId);
        List<ScopaCard> hand = viewer == null ? List.of() : List.copyOf(viewer.getHand());
        List<ScopaCaptureOption> possibleCaptures = hand.stream()
                .map(card -> rules.possibleCaptures(card, game.getTableCards()).stream()
                        .map(capture -> new ScopaCaptureOption(card.id(), capture.stream().map(ScopaCard::id).toList()))
                        .toList())
                .flatMap(List::stream)
                .filter(option -> !option.tableCardIds().isEmpty())
                .distinct()
                .toList();

        return new ScopaGameSnapshot(
                game.getStatus(),
                game.getRoundNumber(),
                List.copyOf(game.getTableCards()),
                hand.stream().sorted(java.util.Comparator.comparing(ScopaCard::id)).toList(),
                possibleCaptures,
                game.getPlayers().values().stream().map(ScopaPlayerPublicSnapshot::from).toList(),
                game.getCurrentPlayerId(),
                game.getStartingPlayerId(),
                game.getLastCapturingPlayerId(),
                game.getWinnerPlayerId(),
                game.getDeck().size(),
                game.getRoundResult(),
                game.getLastEvent()
        );
    }
}
