package com.guerl.scopa.game;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public class ScopaRules {

    public List<List<ScopaCard>> possibleCaptures(ScopaCard playedCard, List<ScopaCard> tableCards) {
        List<ScopaCard> exactMatches = tableCards.stream()
                .filter(card -> card.value() == playedCard.value())
                .toList();
        if (!exactMatches.isEmpty()) {
            return exactMatches.stream().map(List::of).toList();
        }

        List<List<ScopaCard>> combinations = new ArrayList<>();
        collectCombinations(tableCards.stream().sorted(Comparator.comparing(ScopaCard::id)).toList(),
                playedCard.value(), 0, new ArrayList<>(), combinations);
        return combinations;
    }

    public boolean isLegalCapture(ScopaCard playedCard, List<ScopaCard> tableCards, List<String> selectedCardIds) {
        Set<String> selected = Set.copyOf(selectedCardIds);
        return possibleCaptures(playedCard, tableCards).stream()
                .anyMatch(capture -> capture.size() == selected.size()
                        && capture.stream().allMatch(card -> selected.contains(card.id())));
    }

    private void collectCombinations(
            List<ScopaCard> tableCards,
            int remaining,
            int start,
            List<ScopaCard> current,
            List<List<ScopaCard>> combinations
    ) {
        if (remaining == 0) {
            combinations.add(List.copyOf(current));
            return;
        }
        if (remaining < 0) {
            return;
        }

        for (int i = start; i < tableCards.size(); i++) {
            ScopaCard card = tableCards.get(i);
            current.add(card);
            collectCombinations(tableCards, remaining - card.value(), i + 1, current, combinations);
            current.remove(current.size() - 1);
        }
    }
}
