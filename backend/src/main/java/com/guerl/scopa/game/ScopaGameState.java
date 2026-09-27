package com.guerl.scopa.game;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ScopaGameState {

    private ScopaGameStatus status = ScopaGameStatus.ACTIVE;
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

    public ScopaGameStatus getStatus() {
        return status;
    }

    public void setStatus(ScopaGameStatus status) {
        this.status = status;
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
