package com.guerl.scopa.game;

import java.util.List;

public record ScopaRoundResult(
        List<ScopaRoundPlayerResult> players,
        List<ScopaScoreLine> lines
) {
}
