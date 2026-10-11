package com.guerl.scopa.multiplayer.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.guerl.scopa.game.ScopaGameService;
import com.guerl.scopa.game.ScopaGameStatus;
import com.guerl.scopa.multiplayer.room.RoomService;
import com.guerl.scopa.multiplayer.room.RoomSessionResponse;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RoomWebSocketLifecycleTests {
    @Test
    void refreshWithOverlappingSocketsDoesNotPauseUntilTheLastSocketDisconnects() throws Exception {
        RoomService rooms = new RoomService();
        ScopaGameService games = new ScopaGameService(rooms);
        RoomSessionResponse host = rooms.createRoom("Quentin");
        RoomSessionResponse guest = rooms.joinRoom(host.roomCode(), "Manon");
        rooms.setReady(host.roomCode(), host.playerId(), host.sessionToken(), true);
        rooms.setReady(host.roomCode(), guest.playerId(), guest.sessionToken(), true);
        games.startMatch(host.roomCode(), host.playerId(), host.sessionToken());
        var before = games.snapshotForPlayer(host.roomCode(), guest.playerId(), guest.sessionToken()).game();
        RoomBroadcaster broadcaster = new RoomBroadcaster(new ObjectMapper().findAndRegisterModules(), games);
        RoomWebSocketHandler handler = new RoomWebSocketHandler(rooms, broadcaster);
        WebSocketSession oldTab = socket(guest), newTab = socket(guest);
        handler.afterConnectionEstablished(oldTab);
        handler.afterConnectionEstablished(newTab);

        oldTab.close();
        handler.afterConnectionClosed(oldTab, CloseStatus.NORMAL);
        assertThat(games.snapshotForPlayer(host.roomCode(), guest.playerId(), guest.sessionToken()).game()).isEqualTo(before);

        newTab.close();
        handler.afterConnectionClosed(newTab, CloseStatus.NORMAL);
        assertThat(rooms.getRoom(host.roomCode()).players()).hasSize(2);
        assertThat(games.snapshotForPlayer(host.roomCode(), guest.playerId(), guest.sessionToken()).game().status())
                .isEqualTo(ScopaGameStatus.PAUSED);

        WebSocketSession reconnected = socket(guest);
        handler.afterConnectionEstablished(reconnected);
        var restored = games.snapshotForPlayer(host.roomCode(), guest.playerId(), guest.sessionToken());
        assertThat(restored.players()).allSatisfy(player -> assertThat(player.connected()).isTrue());
        assertThat(restored.game()).usingRecursiveComparison().ignoringFields("status").isEqualTo(before);
        assertThat(restored.game().status()).isEqualTo(ScopaGameStatus.PAUSED);
        games.resumeMatch(host.roomCode(), host.playerId(), host.sessionToken());
        assertThat(games.snapshotForPlayer(host.roomCode(), guest.playerId(), guest.sessionToken()).game()).isEqualTo(before);
    }

    @Test
    void hostDisconnectKeepsHostSeatAndAuthority() throws Exception {
        RoomService rooms = new RoomService();
        ScopaGameService games = new ScopaGameService(rooms);
        var host = rooms.createRoom("Quentin");
        var guest = rooms.joinRoom(host.roomCode(), "Manon");
        rooms.setReady(host.roomCode(), host.playerId(), host.sessionToken(), true);
        rooms.setReady(host.roomCode(), guest.playerId(), guest.sessionToken(), true);
        games.startMatch(host.roomCode(), host.playerId(), host.sessionToken());
        RoomBroadcaster broadcaster = new RoomBroadcaster(new ObjectMapper().findAndRegisterModules(), games);
        RoomWebSocketHandler handler = new RoomWebSocketHandler(rooms, broadcaster);
        WebSocketSession hostSocket = socket(host);
        handler.afterConnectionEstablished(hostSocket);
        hostSocket.close();
        handler.afterConnectionClosed(hostSocket, CloseStatus.NORMAL);
        assertThat(rooms.getRoom(host.roomCode()).hostPlayerId()).isEqualTo(host.playerId());
        assertThat(rooms.getRoom(host.roomCode()).players()).hasSize(2);
        assertThat(games.snapshotForPlayer(host.roomCode(), guest.playerId(), guest.sessionToken()).game().status())
                .isEqualTo(ScopaGameStatus.PAUSED);
        handler.afterConnectionEstablished(socket(host));
        games.resumeMatch(host.roomCode(), host.playerId(), host.sessionToken());
    }

    private WebSocketSession socket(RoomSessionResponse player) throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        AtomicBoolean open = new AtomicBoolean(true);
        when(session.isOpen()).thenAnswer(invocation -> open.get());
        when(session.getAttributes()).thenReturn(new HashMap<>());
        when(session.getUri()).thenReturn(URI.create("ws://localhost/ws/rooms/" + player.roomCode()
                + "?playerId=" + player.playerId() + "&sessionToken=" + player.sessionToken()));
        doAnswer(invocation -> { open.set(false); return null; }).when(session).close();
        return session;
    }
}
