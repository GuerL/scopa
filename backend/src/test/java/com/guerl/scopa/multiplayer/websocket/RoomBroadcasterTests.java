package com.guerl.scopa.multiplayer.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.guerl.scopa.game.ScopaGameService;
import com.guerl.scopa.multiplayer.room.RoomException;
import com.guerl.scopa.multiplayer.room.RoomSnapshot;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RoomBroadcasterTests {
    @Test
    void failedPersonalizationNeverSendsActingPlayersFallbackSnapshot() throws Exception {
        ScopaGameService service = mock(ScopaGameService.class);
        WebSocketSession session = mock(WebSocketSession.class);
        RoomSnapshot actingPlayersSnapshot = mock(RoomSnapshot.class);
        when(actingPlayersSnapshot.roomCode()).thenReturn("ROOM");
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(Map.of(
                RoomWebSocketHandler.PLAYER_ID_ATTRIBUTE, "viewer",
                RoomWebSocketHandler.SESSION_TOKEN_ATTRIBUTE, "token"));
        when(service.snapshotForPlayer("ROOM", "viewer", "token"))
                .thenThrow(new RoomException("Unauthorized"));
        RoomBroadcaster broadcaster = new RoomBroadcaster(new ObjectMapper(), service);
        broadcaster.register("ROOM", session);
        broadcaster.broadcast(actingPlayersSnapshot);
        verify(session, never()).sendMessage(any());
        verify(session).close(CloseStatus.NORMAL);
    }
}
