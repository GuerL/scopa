package com.guerl.scopa.multiplayer.websocket;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guerl.scopa.game.ScopaGameService;
import com.guerl.scopa.multiplayer.room.RoomException;
import com.guerl.scopa.multiplayer.room.RoomSnapshot;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RoomBroadcaster {

    private final ObjectMapper objectMapper;
    private final ScopaGameService scopaGameService;
    private final Map<String, Set<WebSocketSession>> sessionsByRoom = new ConcurrentHashMap<>();

    public RoomBroadcaster(ObjectMapper objectMapper, ScopaGameService scopaGameService) {
        this.objectMapper = objectMapper;
        this.scopaGameService = scopaGameService;
    }

    public void register(String roomCode, WebSocketSession session) {
        sessionsByRoom.computeIfAbsent(roomCode, ignored -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void unregister(String roomCode, WebSocketSession session) {
        Set<WebSocketSession> sessions = sessionsByRoom.get(roomCode);
        if (sessions == null) {
            return;
        }

        sessions.remove(session);
        if (sessions.isEmpty()) {
            sessionsByRoom.remove(roomCode);
        }
    }

    public void broadcast(RoomSnapshot room) {
        Set<WebSocketSession> sessions = sessionsByRoom.get(room.roomCode());
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        for (WebSocketSession session : sessions) {
            send(session, serialize(snapshotForSession(room, session)));
        }
    }

    public void closePlayerSession(String roomCode, String playerId) {
        Set<WebSocketSession> sessions = sessionsByRoom.get(roomCode.toUpperCase());
        if (sessions == null) {
            return;
        }

        for (WebSocketSession session : sessions) {
            Object sessionPlayerId = session.getAttributes().get(RoomWebSocketHandler.PLAYER_ID_ATTRIBUTE);
            if (playerId.equals(sessionPlayerId)) {
                close(session);
            }
        }
    }

    public boolean hasOpenPlayerSession(String roomCode, String playerId) {
        Set<WebSocketSession> sessions = sessionsByRoom.get(roomCode.toUpperCase());
        if (sessions == null) {
            return false;
        }

        return sessions.stream()
                .anyMatch(session -> session.isOpen()
                        && playerId.equals(session.getAttributes().get(RoomWebSocketHandler.PLAYER_ID_ATTRIBUTE)));
    }

    private RoomSnapshot snapshotForSession(RoomSnapshot fallback, WebSocketSession session) {
        Object playerId = session.getAttributes().get(RoomWebSocketHandler.PLAYER_ID_ATTRIBUTE);
        Object sessionToken = session.getAttributes().get(RoomWebSocketHandler.SESSION_TOKEN_ATTRIBUTE);
        if (playerId instanceof String id && sessionToken instanceof String token) {
            try {
                return scopaGameService.snapshotForPlayer(fallback.roomCode(), id, token);
            } catch (RoomException ignored) {
            }
        }
        return fallback;
    }

    private String serialize(RoomSnapshot room) {
        try {
            return objectMapper.writeValueAsString(room);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize room snapshot", exception);
        }
    }

    private void send(WebSocketSession session, String payload) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(payload));
            }
        } catch (IOException exception) {
            close(session);
        }
    }

    private void close(WebSocketSession session) {
        try {
            if (session.isOpen()) {
                session.close(CloseStatus.NORMAL);
            }
        } catch (IOException ignored) {
        }
    }
}
