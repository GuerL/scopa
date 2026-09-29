package com.guerl.scopa.multiplayer.room;

import com.guerl.scopa.multiplayer.player.Player;
import com.guerl.scopa.game.ScopaGameState;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class Room {

    public static final int MIN_PLAYERS = 2;
    public static final int MAX_PLAYERS = 4;

    private final String roomCode;
    private final String hostPlayerId;
    private final Instant createdAt;
    private final List<Player> players;
    private RoomStatus status;
    private ScopaGameState game;

    public Room(String roomCode, Player hostPlayer) {
        this.roomCode = roomCode;
        this.hostPlayerId = hostPlayer.getPlayerId();
        this.createdAt = Instant.now();
        this.players = new ArrayList<>();
        this.players.add(hostPlayer);
        this.status = RoomStatus.LOBBY;
    }

    public String getRoomCode() {
        return roomCode;
    }

    public String getHostPlayerId() {
        return hostPlayerId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<Player> getPlayers() {
        return List.copyOf(players);
    }

    public RoomStatus getStatus() {
        return status;
    }

    public void setStatus(RoomStatus status) {
        this.status = status;
    }

    public ScopaGameState getGame() {
        return game;
    }

    public void setGame(ScopaGameState game) {
        this.game = game;
    }

    public void addPlayer(Player player) {
        players.add(player);
    }

    public boolean removePlayer(String playerId) {
        return players.removeIf(player -> player.getPlayerId().equals(playerId));
    }

    public boolean isEmpty() {
        return players.isEmpty();
    }

    public Optional<Player> findPlayer(String playerId) {
        return players.stream()
                .filter(player -> player.getPlayerId().equals(playerId))
                .findFirst();
    }

    public boolean hasDisplayName(String displayName) {
        return players.stream()
                .anyMatch(player -> player.getDisplayName().equalsIgnoreCase(displayName));
    }

    public boolean isFull() {
        return players.size() >= MAX_PLAYERS;
    }
}
