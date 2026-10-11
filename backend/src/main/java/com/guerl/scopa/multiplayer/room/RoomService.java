package com.guerl.scopa.multiplayer.room;

import com.guerl.scopa.game.ScopaRules;
import com.guerl.scopa.game.ScopaGameStatus;
import com.guerl.scopa.multiplayer.player.Player;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoomService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int ROOM_CODE_LENGTH = 5;

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public RoomSessionResponse createRoom(String displayName) {
        String normalizedName = normalizeDisplayName(displayName);
        String roomCode = createUniqueRoomCode();
        Player host = new Player(createId(), createId(), normalizedName, true);
        Room room = new Room(roomCode, host);
        rooms.put(roomCode, room);
        return toSessionResponse(room, host);
    }

    public RoomSessionResponse joinRoom(String roomCode, String displayName) {
        return joinRoom(roomCode, displayName, null, null);
    }

    public RoomSessionResponse joinRoom(String roomCode, String displayName, String playerId, String sessionToken) {
        Room room = getRequiredRoom(normalizeRoomCode(roomCode));
        synchronized (room) {
            // Credentials reclaim the existing seat, even in a full, paused room.
            // Display names are never used as proof of identity.
            if (playerId != null || sessionToken != null) {
                if (room.findPlayer(playerId).isEmpty()) {
                    throw new RoomException("Your reserved seat is no longer available. The host may have ended the game");
                }
                Player player = getAuthorizedPlayer(room, playerId, sessionToken);
                player.setConnected(true);
                return toSessionResponse(room, player);
            }
            if (room.getGame() != null) {
                throw new RoomException("Match already started. Rejoin using your original player session");
            }
            String normalizedName = normalizeDisplayName(displayName);
            if (room.isFull()) {
                throw new RoomException("Room is full");
            }
            if (room.hasDisplayName(normalizedName)) {
                throw new RoomException("A player with that name is already in this room");
            }

            Player player = new Player(createId(), createId(), normalizedName, false);
            room.addPlayer(player);
            return toSessionResponse(room, player);
        }
    }

    public RoomSnapshot getRoom(String roomCode) {
        Room room = getRequiredRoom(normalizeRoomCode(roomCode));
        synchronized (room) {
            return RoomSnapshot.from(room);
        }
    }

    public RoomSnapshot setReady(String roomCode, String playerId, String sessionToken, boolean ready) {
        Room room = getRequiredRoom(normalizeRoomCode(roomCode));
        synchronized (room) {
            Player player = getAuthorizedPlayer(room, playerId, sessionToken);
            player.setReady(ready);
            return RoomSnapshot.from(room);
        }
    }

    public Optional<RoomSnapshot> leaveRoom(String roomCode, String playerId, String sessionToken) {
        String normalizedRoomCode = normalizeRoomCode(roomCode);
        Room room = getRequiredRoom(normalizedRoomCode);
        synchronized (room) {
            Player player = getAuthorizedPlayer(room, playerId, sessionToken);
            if (hasUnfinishedMatch(room)) {
                markUnavailable(room, player);
                return Optional.of(RoomSnapshot.from(room));
            }
            room.removePlayer(playerId);
            if (room.getGame() != null) {
                room.getGame().getPlayers().remove(playerId);
            }
            if (room.isEmpty()) {
                rooms.remove(normalizedRoomCode);
                return Optional.empty();
            }
            return Optional.of(RoomSnapshot.from(room));
        }
    }

    public Optional<RoomSnapshot> markConnected(String roomCode, String playerId, String sessionToken, boolean connected) {
        String normalizedRoomCode = normalizeRoomCode(roomCode);
        Room room = rooms.get(normalizedRoomCode);
        if (room == null) {
            return Optional.empty();
        }

        synchronized (room) {
            Player player = getAuthorizedPlayer(room, playerId, sessionToken);
            if (connected) {
                player.setConnected(true);
            } else {
                markUnavailable(room, player);
            }
            return Optional.of(RoomSnapshot.from(room));
        }
    }

    public boolean roomExists(String roomCode) {
        return rooms.containsKey(normalizeRoomCode(roomCode));
    }

    public <T> T withAuthorizedRoom(
            String roomCode,
            String playerId,
            String sessionToken,
            BiFunction<Room, Player, T> callback
    ) {
        Room room = getRequiredRoom(normalizeRoomCode(roomCode));
        synchronized (room) {
            Player player = getAuthorizedPlayer(room, playerId, sessionToken);
            return callback.apply(room, player);
        }
    }

    String createUniqueRoomCode() {
        String code;
        do {
            code = randomRoomCode();
        } while (rooms.containsKey(code));
        return code;
    }

    private String randomRoomCode() {
        StringBuilder code = new StringBuilder(ROOM_CODE_LENGTH);
        for (int i = 0; i < ROOM_CODE_LENGTH; i++) {
            code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        }
        return code.toString();
    }

    private Room getRequiredRoom(String roomCode) {
        Room room = rooms.get(roomCode);
        if (room == null) {
            throw new RoomNotFoundException(roomCode);
        }
        return room;
    }

    private Player getAuthorizedPlayer(Room room, String playerId, String sessionToken) {
        String normalizedPlayerId = requireValue(playerId, "playerId");
        String normalizedSessionToken = requireValue(sessionToken, "sessionToken");
        Player player = room.findPlayer(normalizedPlayerId)
                .orElseThrow(() -> new RoomException("Player is not in this room"));

        if (!player.getSessionToken().equals(normalizedSessionToken)) {
            throw new RoomException("Invalid player session");
        }

        return player;
    }

    private RoomSessionResponse toSessionResponse(Room room, Player player) {
        return new RoomSessionResponse(
                room.getRoomCode(),
                player.getPlayerId(),
                player.getSessionToken(),
                RoomSnapshot.from(room, player.getPlayerId(), new ScopaRules())
        );
    }

    private boolean hasUnfinishedMatch(Room room) {
        return room.getGame() != null && room.getGame().getStatus() != ScopaGameStatus.MATCH_FINISHED;
    }

    private void markUnavailable(Room room, Player player) {
        player.setConnected(false);
        if (hasUnfinishedMatch(room)) {
            room.getGame().pause();
            room.setStatus(RoomStatus.PAUSED);
        }
    }

    private String normalizeDisplayName(String displayName) {
        String value = requireValue(displayName, "displayName").trim();
        if (value.length() > 24) {
            throw new RoomException("Display name must be 24 characters or fewer");
        }
        return value;
    }

    private String normalizeRoomCode(String roomCode) {
        return requireValue(roomCode, "roomCode").trim().toUpperCase(Locale.ROOT);
    }

    private String requireValue(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new RoomException(fieldName + " is required");
        }
        return value;
    }

    private String createId() {
        return UUID.randomUUID().toString();
    }
}
