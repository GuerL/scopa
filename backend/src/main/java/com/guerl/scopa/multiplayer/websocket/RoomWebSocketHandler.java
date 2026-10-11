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
            // Register and update presence under the room lock. A closing old tab
            // must not mark a newly connected replacement tab unavailable.
            RoomSnapshot room = roomService.withAuthorizedRoom(roomCode, playerId, sessionToken, (current, player) -> {
                session.getAttributes().put(ROOM_CODE_ATTRIBUTE, current.getRoomCode());
                session.getAttributes().put(PLAYER_ID_ATTRIBUTE, playerId);
                session.getAttributes().put(SESSION_TOKEN_ATTRIBUTE, sessionToken);
                roomBroadcaster.register(current.getRoomCode(), session);
                player.setConnected(true);
                return RoomSnapshot.from(current);
            });
            roomBroadcaster.broadcast(room);
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

        if (!roomService.roomExists(roomCode)) {
            roomBroadcaster.unregister(roomCode, session);
            return;
        }

        try {
            Optional<RoomSnapshot> changed = roomService.withAuthorizedRoom(roomCode, playerId, sessionToken, (room, player) -> {
                roomBroadcaster.unregister(roomCode, session);
                return roomBroadcaster.hasOpenPlayerSession(roomCode, playerId)
                        ? Optional.empty()
                        : roomService.markConnected(roomCode, playerId, sessionToken, false);
            });
            changed.ifPresent(roomBroadcaster::broadcast);
        } catch (RoomException ignored) {
            roomBroadcaster.unregister(roomCode, session);
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
