package com.guerl.scopa.game;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

public class ScopaScoringService {

    public ScopaRoundResult scoreRound(List<String> playerOrder, ScopaGameState game) {
        Map<String, Integer> roundPoints = new LinkedHashMap<>();
        playerOrder.forEach(playerId -> roundPoints.put(playerId, 0));
        List<ScopaScoreLine> lines = new ArrayList<>();

        lines.add(highestValueLine(playerOrder, game, roundPoints, "Most cards",
                player -> player.getCapturedCards().size(),
                value -> value + " cards"));
        lines.add(highestValueLine(playerOrder, game, roundPoints, "Most Gold",
                this::countGold,
                String::valueOf));
        lines.add(booleanLine(playerOrder, game, roundPoints, "7 Gold",
                player -> hasGoldValue(player, 7),
                "Captured"));
        lines.add(booleanLine(playerOrder, game, roundPoints, "10 Gold",
                player -> hasGoldValue(player, 10),
                "Captured"));
        lines.add(scopaLine(playerOrder, game, roundPoints));

        List<ScopaRoundPlayerResult> playerResults = playerOrder.stream()
                .map(playerId -> {
                    ScopaPlayerState player = game.getPlayers().get(playerId);
                    int points = roundPoints.get(playerId);
                    player.setRoundPoints(points);
                    player.setTotalPoints(player.getTotalPoints() + points);
                    return new ScopaRoundPlayerResult(playerId, points, player.getTotalPoints());
                })
                .toList();

        return new ScopaRoundResult(playerResults, lines);
    }

    private ScopaScoreLine highestValueLine(
            List<String> playerOrder,
            ScopaGameState game,
            Map<String, Integer> roundPoints,
            String label,
            Function<ScopaPlayerState, Integer> value,
            Function<Integer, String> detail
    ) {
        Map<String, Integer> values = new LinkedHashMap<>();
        int highest = Integer.MIN_VALUE;
        for (String playerId : playerOrder) {
            int playerValue = value.apply(game.getPlayers().get(playerId));
            values.put(playerId, playerValue);
            highest = Math.max(highest, playerValue);
        }

        int winners = 0;
        for (int playerValue : values.values()) {
            if (playerValue == highest) {
                winners++;
            }
        }
        int winningValue = highest;
        int winnerCount = winners;

        List<ScopaScoreLinePlayer> linePlayers = playerOrder.stream()
                .map(playerId -> {
                    int points = winnerCount == 1 && values.get(playerId) == winningValue ? 1 : 0;
                    roundPoints.computeIfPresent(playerId, (id, current) -> current + points);
                    return new ScopaScoreLinePlayer(playerId, points, detail.apply(values.get(playerId)));
                })
                .toList();
        return new ScopaScoreLine(label, linePlayers);
    }

    private ScopaScoreLine booleanLine(
            List<String> playerOrder,
            ScopaGameState game,
            Map<String, Integer> roundPoints,
            String label,
            Function<ScopaPlayerState, Boolean> captured,
            String capturedDetail
    ) {
        List<ScopaScoreLinePlayer> linePlayers = playerOrder.stream()
                .map(playerId -> {
                    boolean hasCard = captured.apply(game.getPlayers().get(playerId));
                    int points = hasCard ? 1 : 0;
                    roundPoints.computeIfPresent(playerId, (id, current) -> current + points);
                    return new ScopaScoreLinePlayer(playerId, points, hasCard ? capturedDetail : "-");
                })
                .toList();
        return new ScopaScoreLine(label, linePlayers);
    }

    private ScopaScoreLine scopaLine(List<String> playerOrder, ScopaGameState game, Map<String, Integer> roundPoints) {
        List<ScopaScoreLinePlayer> linePlayers = playerOrder.stream()
                .map(playerId -> {
                    int points = game.getPlayers().get(playerId).getScopasThisRound();
                    roundPoints.computeIfPresent(playerId, (id, current) -> current + points);
                    return new ScopaScoreLinePlayer(playerId, points, points + " Scopa");
                })
                .toList();
        return new ScopaScoreLine("Scopa", linePlayers);
    }

    private int countGold(ScopaPlayerState player) {
        return (int) player.getCapturedCards().stream()
                .filter(card -> card.suit() == ScopaSuit.GOLD)
                .count();
    }

    private boolean hasGoldValue(ScopaPlayerState player, int value) {
        return player.getCapturedCards().stream()
                .anyMatch(card -> card.suit() == ScopaSuit.GOLD && card.value() == value);
    }
}
