package com.guerl.scopa.game;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ScopaGameState {

    private ScopaGameStatus status = ScopaGameStatus.ACTIVE;
    private ScopaGameStatus pausedFromStatus;
    private int roundNumber = 1;
    private final List<ScopaCard> deck = new ArrayList<>();
    private final List<ScopaCard> tableCards = new ArrayList<>();
    private final Map<String, ScopaPlayerState> players = new LinkedHashMap<>();
    private String currentPlayerId;
    private String startingPlayerId;
    private String lastCapturingPlayerId;
    private String winnerPlayerId;
    private ScopaRoundResult roundResult;
    private String lastEvent;
    private long moveSequence;
    private ScopaLastMove lastMove;

    public ScopaLastMove getLastMove() { return lastMove; }

    public long getMoveSequence() { return moveSequence; }

    public void recordMove(String playerId, String displayName, ScopaCard playedCard,
                           List<ScopaCard> capturedCards, boolean scopa) {
        lastMove = new ScopaLastMove(playerId, displayName, playedCard, capturedCards, scopa, ++moveSequence);
    }

    public void clearLastMove() { lastMove = null; }


    public ScopaGameStatus getStatus() {
        return status;
    }

    public void setStatus(ScopaGameStatus status) {
        this.status = status;
    }

    public void pause() {
        if (status == ScopaGameStatus.ACTIVE || status == ScopaGameStatus.ROUND_FINISHED) {
            pausedFromStatus = status;
            status = ScopaGameStatus.PAUSED;
        }
    }

    public void resume() {
        if (status == ScopaGameStatus.PAUSED) {
            status = pausedFromStatus;
            pausedFromStatus = null;
        }
    }

    public int getRoundNumber() {
        return roundNumber;
    }

    public void setRoundNumber(int roundNumber) {
        this.roundNumber = roundNumber;
    }

    public List<ScopaCard> getDeck() {
        return deck;
    }

    public List<ScopaCard> getTableCards() {
        return tableCards;
    }

    public Map<String, ScopaPlayerState> getPlayers() {
        return players;
    }

    public String getCurrentPlayerId() {
        return currentPlayerId;
    }

    public void setCurrentPlayerId(String currentPlayerId) {
        this.currentPlayerId = currentPlayerId;
    }

    public String getStartingPlayerId() {
        return startingPlayerId;
    }

    public void setStartingPlayerId(String startingPlayerId) {
        this.startingPlayerId = startingPlayerId;
    }

    public String getLastCapturingPlayerId() {
        return lastCapturingPlayerId;
    }

    public void setLastCapturingPlayerId(String lastCapturingPlayerId) {
        this.lastCapturingPlayerId = lastCapturingPlayerId;
    }

    public String getWinnerPlayerId() {
        return winnerPlayerId;
    }

    public void setWinnerPlayerId(String winnerPlayerId) {
        this.winnerPlayerId = winnerPlayerId;
    }

    public ScopaRoundResult getRoundResult() {
        return roundResult;
    }

    public void setRoundResult(ScopaRoundResult roundResult) {
        this.roundResult = roundResult;
    }

    public String getLastEvent() {
        return lastEvent;
    }

    public void setLastEvent(String lastEvent) {
        this.lastEvent = lastEvent;
    }
}
