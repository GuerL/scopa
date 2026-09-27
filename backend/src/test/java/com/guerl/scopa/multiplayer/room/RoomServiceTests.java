package com.guerl.scopa.multiplayer.room;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RoomServiceTests {

    private final RoomService roomService = new RoomService();

    @Test
    void createsRoomWithHost() {
        RoomSessionResponse response = roomService.createRoom("Quentin");

        assertThat(response.roomCode()).hasSize(5);
        assertThat(response.playerId()).isNotBlank();
        assertThat(response.sessionToken()).isNotBlank();
        assertThat(response.room().hostPlayerId()).isEqualTo(response.playerId());
        assertThat(response.room().players()).singleElement().satisfies(player -> {
            assertThat(player.displayName()).isEqualTo("Quentin");
            assertThat(player.host()).isTrue();
            assertThat(player.ready()).isFalse();
            assertThat(player.connected()).isTrue();
        });
    }

    @Test
    void joinsRoomAsSecondPlayer() {
        RoomSessionResponse host = roomService.createRoom("Quentin");

        RoomSessionResponse guest = roomService.joinRoom(host.roomCode(), "Manon");

        assertThat(guest.room().players()).hasSize(2);
        assertThat(guest.room().hostPlayerId()).isEqualTo(host.playerId());
        assertThat(guest.room().players())
                .anySatisfy(player -> {
                    assertThat(player.displayName()).isEqualTo("Manon");
                    assertThat(player.host()).isFalse();
                });
    }

    @Test
    void rejectsDuplicateNamesWithinRoom() {
        RoomSessionResponse host = roomService.createRoom("Quentin");

        assertThatThrownBy(() -> roomService.joinRoom(host.roomCode(), "quentin"))
                .isInstanceOf(RoomException.class)
                .hasMessageContaining("name");
    }

    @Test
    void rejectsRoomWhenFull() {
        RoomSessionResponse host = roomService.createRoom("Quentin");
        roomService.joinRoom(host.roomCode(), "Manon");

        assertThatThrownBy(() -> roomService.joinRoom(host.roomCode(), "Lina"))
                .isInstanceOf(RoomException.class)
                .hasMessageContaining("full");
    }

    @Test
    void changesReadyState() {
        RoomSessionResponse host = roomService.createRoom("Quentin");

        RoomSnapshot readyRoom = roomService.setReady(host.roomCode(), host.playerId(), host.sessionToken(), true);
        assertThat(readyRoom.players()).singleElement().satisfies(player -> assertThat(player.ready()).isTrue());

        RoomSnapshot notReadyRoom = roomService.setReady(host.roomCode(), host.playerId(), host.sessionToken(), false);
        assertThat(notReadyRoom.players()).singleElement().satisfies(player -> assertThat(player.ready()).isFalse());
    }

    @Test
    void leavesRoom() {
        RoomSessionResponse host = roomService.createRoom("Quentin");
        RoomSessionResponse guest = roomService.joinRoom(host.roomCode(), "Manon");

        RoomSnapshot room = roomService.leaveRoom(host.roomCode(), guest.playerId(), guest.sessionToken()).orElseThrow();

        assertThat(room.players()).singleElement().satisfies(player -> {
            assertThat(player.playerId()).isEqualTo(host.playerId());
            assertThat(player.host()).isTrue();
        });
    }

    @Test
    void deletesRoomWhenEmpty() {
        RoomSessionResponse host = roomService.createRoom("Quentin");

        assertThat(roomService.leaveRoom(host.roomCode(), host.playerId(), host.sessionToken())).isEmpty();
        assertThatThrownBy(() -> roomService.getRoom(host.roomCode()))
                .isInstanceOf(RoomNotFoundException.class);
    }
}
