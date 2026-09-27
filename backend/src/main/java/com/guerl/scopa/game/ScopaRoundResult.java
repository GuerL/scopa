package com.guerl.scopa.game;

import java.util.List;

public record ScopaRoundResult(
        String leftPlayerId,
        String rightPlayerId,
        List<ScopaScoreLine> lines,
        int leftRoundPoints,
        int rightRoundPoints,
        int leftTotalPoints,
        int rightTotalPoints
) {
}
