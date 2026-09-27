package com.guerl.scopa.multiplayer.player;

public class Player {

    private final String playerId;
    private final String sessionToken;
    private final String displayName;
    private final boolean host;
    private boolean ready;
    private boolean connected;

    public Player(String playerId, String sessionToken, String displayName, boolean host) {
        this.playerId = playerId;
        this.sessionToken = sessionToken;
        this.displayName = displayName;
        this.host = host;
        this.ready = false;
        this.connected = true;
    }

    public String getPlayerId() {
        return playerId;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public String getDisplayName() {
        return displayName;
    }

    public boolean isHost() {
        return host;
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }

    public boolean isConnected() {
        return connected;
    }

    public void setConnected(boolean connected) {
        this.connected = connected;
    }
}
