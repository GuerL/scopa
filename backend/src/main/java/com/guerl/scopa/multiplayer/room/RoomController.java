package com.guerl.scopa.multiplayer.room;

import com.guerl.scopa.game.PlayCardRequest;
import com.guerl.scopa.game.PlayerActionRequest;
import com.guerl.scopa.game.ScopaGameService;
import com.guerl.scopa.multiplayer.websocket.RoomBroadcaster;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final RoomBroadcaster roomBroadcaster;
    private final ScopaGameService scopaGameService;

    public RoomController(RoomService roomService, RoomBroadcaster roomBroadcaster, ScopaGameService scopaGameService) {
        this.roomService = roomService;
        this.roomBroadcaster = roomBroadcaster;
        this.scopaGameService = scopaGameService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomSessionResponse create(@RequestBody CreateRoomRequest request) {
        RoomSessionResponse response = roomService.createRoom(request.displayName());
        roomBroadcaster.broadcast(response.room());
        return response;
    }

    @PostMapping("/{roomCode}/join")
    public RoomSessionResponse join(@PathVariable String roomCode, @RequestBody JoinRoomRequest request) {
        RoomSessionResponse response = roomService.joinRoom(roomCode, request.displayName());
        roomBroadcaster.broadcast(response.room());
        return response;
    }

    @GetMapping("/{roomCode}")
    public RoomSnapshot get(@PathVariable String roomCode) {
        return roomService.getRoom(roomCode);
    }

    @PostMapping("/{roomCode}/ready")
    public RoomSnapshot ready(@PathVariable String roomCode, @RequestBody ReadyRequest request) {
        RoomSnapshot room = roomService.setReady(roomCode, request.playerId(), request.sessionToken(), request.ready());
        roomBroadcaster.broadcast(room);
        return room;
    }

    @PostMapping("/{roomCode}/leave")
    public Map<String, Object> leave(@PathVariable String roomCode, @RequestBody LeaveRoomRequest request) {
        Optional<RoomSnapshot> room = roomService.leaveRoom(roomCode, request.playerId(), request.sessionToken());
        room.ifPresent(roomBroadcaster::broadcast);
        roomBroadcaster.closePlayerSession(roomCode, request.playerId());
        return Map.of("roomDeleted", room.isEmpty());
    }

    @PostMapping("/{roomCode}/game/start")
    public RoomSnapshot startGame(@PathVariable String roomCode, @RequestBody PlayerActionRequest request) {
        RoomSnapshot room = scopaGameService.startMatch(roomCode, request.playerId(), request.sessionToken());
        roomBroadcaster.broadcast(room);
        return room;
    }

    @GetMapping("/{roomCode}/game")
    public RoomSnapshot game(
            @PathVariable String roomCode,
            @RequestParam String playerId,
            @RequestParam String sessionToken
    ) {
        return scopaGameService.snapshotForPlayer(roomCode, playerId, sessionToken);
    }

    @PostMapping("/{roomCode}/game/play")
    public RoomSnapshot playCard(@PathVariable String roomCode, @RequestBody PlayCardRequest request) {
        RoomSnapshot room = scopaGameService.playCard(roomCode, request);
        roomBroadcaster.broadcast(room);
        return room;
    }

    @PostMapping("/{roomCode}/game/next-round")
    public RoomSnapshot nextRound(@PathVariable String roomCode, @RequestBody PlayerActionRequest request) {
        RoomSnapshot room = scopaGameService.acknowledgeNextRound(roomCode, request.playerId(), request.sessionToken());
        roomBroadcaster.broadcast(room);
        return room;
    }

    @PostMapping("/{roomCode}/game/rematch")
    public RoomSnapshot rematch(@PathVariable String roomCode, @RequestBody PlayerActionRequest request) {
        RoomSnapshot room = scopaGameService.requestRematch(roomCode, request.playerId(), request.sessionToken());
        roomBroadcaster.broadcast(room);
        return room;
    }

    @ExceptionHandler(RoomNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleNotFound(RoomNotFoundException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(RoomException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleRoomException(RoomException exception) {
        return Map.of("message", exception.getMessage());
    }
}
