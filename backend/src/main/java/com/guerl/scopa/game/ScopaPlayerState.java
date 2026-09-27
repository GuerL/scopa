package com.guerl.scopa.game;

import java.util.ArrayList;
import java.util.List;

public class ScopaPlayerState {

    private final String playerId;
    private final List<ScopaCard> hand = new ArrayList<>();
    private final List<ScopaCard> capturedCards = new ArrayList<>();
    private int scopasThisRound;
    private int roundPoints;
    private int totalPoints;
    private boolean roundAcknowledged;
    private boolean rematchRequested;

    public ScopaPlayerState(String playerId) {
        this.playerId = playerId;
    }

    public String getPlayerId() {
        return playerId;
    }

    public List<ScopaCard> getHand() {
        return hand;
    }

    public List<ScopaCard> getCapturedCards() {
        return capturedCards;
    }

    public int getScopasThisRound() {
        return scopasThisRound;
    }

    public void incrementScopasThisRound() {
        scopasThisRound++;
    }

    public int getRoundPoints() {
        return roundPoints;
    }

    public void setRoundPoints(int roundPoints) {
        this.roundPoints = roundPoints;
    }

    public int getTotalPoints() {
        return totalPoints;
    }

    public void setTotalPoints(int totalPoints) {
        this.totalPoints = totalPoints;
    }

    public boolean isRoundAcknowledged() {
        return roundAcknowledged;
    }

    public void setRoundAcknowledged(boolean roundAcknowledged) {
        this.roundAcknowledged = roundAcknowledged;
    }

    public boolean isRematchRequested() {
        return rematchRequested;
    }

    public void setRematchRequested(boolean rematchRequested) {
        this.rematchRequested = rematchRequested;
    }

    public void resetForRound() {
        hand.clear();
        capturedCards.clear();
        scopasThisRound = 0;
        roundPoints = 0;
        roundAcknowledged = false;
        rematchRequested = false;
    }

    public void resetForMatch() {
        totalPoints = 0;
        resetForRound();
    }
}
