package com.guerl.scopa.game;

import java.util.ArrayList;
import java.util.List;

public class ScopaScoringService {

    public ScopaRoundResult scoreRound(List<String> playerOrder, ScopaGameState game) {
        String leftId = playerOrder.get(0);
        String rightId = playerOrder.get(1);
        ScopaPlayerState left = game.getPlayers().get(leftId);
        ScopaPlayerState right = game.getPlayers().get(rightId);

        int leftCards = left.getCapturedCards().size();
        int rightCards = right.getCapturedCards().size();
        int leftGold = countGold(left);
        int rightGold = countGold(right);
        boolean leftGold7 = hasGoldValue(left, 7);
        boolean rightGold7 = hasGoldValue(right, 7);
        boolean leftGold10 = hasGoldValue(left, 10);
        boolean rightGold10 = hasGoldValue(right, 10);

        int leftRound = 0;
        int rightRound = 0;
        List<ScopaScoreLine> lines = new ArrayList<>();

        int leftMostCards = leftCards > rightCards ? 1 : 0;
        int rightMostCards = rightCards > leftCards ? 1 : 0;
        leftRound += leftMostCards;
        rightRound += rightMostCards;
        lines.add(new ScopaScoreLine("Most cards", leftMostCards, rightMostCards, leftCards + " cards", rightCards + " cards"));

        int leftMostGold = leftGold > rightGold ? 1 : 0;
        int rightMostGold = rightGold > leftGold ? 1 : 0;
        leftRound += leftMostGold;
        rightRound += rightMostGold;
        lines.add(new ScopaScoreLine("Most Gold", leftMostGold, rightMostGold, String.valueOf(leftGold), String.valueOf(rightGold)));

        int leftSettebello = leftGold7 ? 1 : 0;
        int rightSettebello = rightGold7 ? 1 : 0;
        leftRound += leftSettebello;
        rightRound += rightSettebello;
        lines.add(new ScopaScoreLine("7 Gold", leftSettebello, rightSettebello, leftGold7 ? "Captured" : "-", rightGold7 ? "Captured" : "-"));

        int leftGoldTen = leftGold10 ? 1 : 0;
        int rightGoldTen = rightGold10 ? 1 : 0;
        leftRound += leftGoldTen;
        rightRound += rightGoldTen;
        lines.add(new ScopaScoreLine("10 Gold", leftGoldTen, rightGoldTen, leftGold10 ? "Captured" : "-", rightGold10 ? "Captured" : "-"));

        int leftScopa = left.getScopasThisRound();
        int rightScopa = right.getScopasThisRound();
        leftRound += leftScopa;
        rightRound += rightScopa;
        lines.add(new ScopaScoreLine("Scopa", leftScopa, rightScopa, leftScopa + " Scopa", rightScopa + " Scopa"));

        left.setRoundPoints(leftRound);
        right.setRoundPoints(rightRound);
        left.setTotalPoints(left.getTotalPoints() + leftRound);
        right.setTotalPoints(right.getTotalPoints() + rightRound);

        return new ScopaRoundResult(
                leftId,
                rightId,
                lines,
                leftRound,
                rightRound,
                left.getTotalPoints(),
                right.getTotalPoints()
        );
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
