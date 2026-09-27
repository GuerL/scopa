package com.guerl.scopa.game;

import java.util.List;

public record PlayCardRequest(String playerId, String sessionToken, String cardId, List<String> captureCardIds) {
}
