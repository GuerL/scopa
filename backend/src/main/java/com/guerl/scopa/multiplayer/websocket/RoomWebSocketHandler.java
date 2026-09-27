package com.guerl.scopa.multiplayer.websocket;

import com.guerl.scopa.multiplayer.room.RoomException;
import com.guerl.scopa.multiplayer.room.RoomService;
import com.guerl.scopa.multiplayer.room.RoomSnapshot;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Optional;

@Component
public class RoomWebSocketHandler extends TextWebSocketHandler {

    public static final String ROOM_CODE_ATTRIBUTE = "roomCode";
    public static final String PLAYER_ID_ATTRIBUTE = "playerId";
    public static final String SESSION_TOKEN_ATTRIBUTE = "sessionToken";

    private final RoomService roomService;
    private final RoomBroadcaster roomBroadcaster;

    public RoomWebSocketHandler(RoomService roomService, RoomBroadcaster roomBroadcaster) {
        this.roomService = roomService;
        this.roomBroadcaster = roomBroadcaster;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        if (uri == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String roomCode = extractRoomCode(uri);
        String playerId = queryParam(uri, "playerId");
        String sessionToken = queryParam(uri, "sessionToken");

        try {
            Optional<RoomSnapshot> room = roomService.markConnected(roomCode, playerId, sessionToken, true);
            if (room.isEmpty()) {
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Room not found"));
                return;
            }

            session.getAttributes().put(ROOM_CODE_ATTRIBUTE, roomCode.toUpperCase());
            session.getAttributes().put(PLAYER_ID_ATTRIBUTE, playerId);
            session.getAttributes().put(SESSION_TOKEN_ATTRIBUTE, sessionToken);
            roomBroadcaster.register(roomCode.toUpperCase(), session);
            roomBroadcaster.broadcast(room.get());
        } catch (RoomException exception) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason(exception.getMessage()));
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Object roomCode = session.getAttributes().get(ROOM_CODE_ATTRIBUTE);
        if (roomCode instanceof String code && roomService.roomExists(code)) {
            roomBroadcaster.broadcast(roomService.getRoom(code));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Object roomCodeValue = session.getAttributes().get(ROOM_CODE_ATTRIBUTE);
        Object playerIdValue = session.getAttributes().get(PLAYER_ID_ATTRIBUTE);
        Object sessionTokenValue = session.getAttributes().get(SESSION_TOKEN_ATTRIBUTE);
        if (!(roomCodeValue instanceof String roomCode)
                || !(playerIdValue instanceof String playerId)
                || !(sessionTokenValue instanceof String sessionToken)) {
            return;
        }

        roomBroadcaster.unregister(roomCode, session);

        if (!roomService.roomExists(roomCode)) {
            return;
        }

        try {
            if (!roomBroadcaster.hasOpenPlayerSession(roomCode, playerId)) {
                roomService.markConnected(roomCode, playerId, sessionToken, false)
                        .ifPresent(roomBroadcaster::broadcast);
            }
        } catch (RoomException ignored) {
        }
    }

    private String extractRoomCode(URI uri) {
        String path = uri.getPath();
        String prefix = "/ws/rooms/";
        if (!path.startsWith(prefix) || path.length() <= prefix.length()) {
            throw new RoomException("Room code is required");
        }
        return path.substring(prefix.length());
    }

    private String queryParam(URI uri, String name) {
        String value = UriComponentsBuilder.fromUri(uri)
                .build()
                .getQueryParams()
                .getFirst(name);
        if (value == null || value.isBlank()) {
            throw new RoomException(name + " is required");
        }
        return value;
    }
}
