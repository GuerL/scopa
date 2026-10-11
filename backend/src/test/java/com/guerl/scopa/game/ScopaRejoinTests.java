package com.guerl.scopa.game;

import com.guerl.scopa.multiplayer.room.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.*;

class ScopaRejoinTests {

    @ParameterizedTest
    @ValueSource(ints = {2, 3})
    void temporaryLeaveAndRejoinPreserveTheEntireMatch(int playerCount) {
        Fixture f = fixture(playerCount);
        RoomSessionResponse guest = f.players.get(1);
        ScopaGameState originalGame = f.room.getGame();
        ScopaPlayerState originalSeat = originalGame.getPlayers().get(guest.playerId());
        var originalPlayer = f.room.findPlayer(guest.playerId()).orElseThrow();
        List<ScopaCard> deck = List.copyOf(originalGame.getDeck());
        List<ScopaCard> hand = List.copyOf(originalSeat.getHand());
        List<ScopaCard> captured = List.copyOf(originalSeat.getCapturedCards());
        List<String> order = f.room.getPlayers().stream().map(p -> p.getPlayerId()).toList();
        ScopaGameSnapshot before = view(f, guest).game();
        assertThat(hand).extracting(c -> c.suit() + ":" + c.value())
                .containsExactly("GOLD:3", "SWORDS:7", "CUPS:10");

        f.rooms.leaveRoom(f.host.roomCode(), guest.playerId(), guest.sessionToken());

        assertThat(originalGame.getStatus()).isEqualTo(ScopaGameStatus.PAUSED);
        assertThat(f.room.getStatus()).isEqualTo(RoomStatus.PAUSED);
        assertThat(originalGame.getWinnerPlayerId()).isNull();
        assertThat(f.room.getPlayers()).hasSize(playerCount);
        assertThat(f.room.findPlayer(guest.playerId()).orElseThrow()).isSameAs(originalPlayer);
        assertThat(originalPlayer.isConnected()).isFalse();
        assertThat(originalGame.getPlayers().get(guest.playerId())).isSameAs(originalSeat);
        assertThat(originalGame.getDeck()).containsExactlyElementsOf(deck);
        assertThat(view(f, guest).game()).usingRecursiveComparison().ignoringFields("status").isEqualTo(before);
        assertThatThrownBy(() -> f.games.playCard(f.host.roomCode(), new PlayCardRequest(
                guest.playerId(), guest.sessionToken(), hand.getFirst().id(), List.of())))
                .hasMessageContaining("not active");
        assertThatThrownBy(() -> f.games.resumeMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken()))
                .hasMessageContaining("Waiting");

        RoomSessionResponse rejoined = f.rooms.joinRoom(f.host.roomCode(), "Different name",
                guest.playerId(), guest.sessionToken());

        assertThat(rejoined.playerId()).isEqualTo(guest.playerId());
        assertThat(rejoined.sessionToken()).isEqualTo(guest.sessionToken());
        assertThat(originalPlayer.getDisplayName()).isEqualTo("Manon");
        assertThat(originalPlayer.isConnected()).isTrue();
        assertThat(rejoined.room().game().hand()).containsExactlyInAnyOrderElementsOf(hand);
        assertThat(rejoined.room().game().capturedCards()).containsExactlyElementsOf(captured);
        assertThat(rejoined.room().game()).usingRecursiveComparison().ignoringFields("status").isEqualTo(before);
        assertThat(originalGame.getStatus()).isEqualTo(ScopaGameStatus.PAUSED);
        assertThatThrownBy(() -> f.games.resumeMatch(f.host.roomCode(), guest.playerId(), guest.sessionToken()))
                .hasMessageContaining("host");
        assertThatThrownBy(() -> f.games.startMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken()))
                .hasMessageContaining("already started");

        f.games.resumeMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken());

        assertThat(f.room.getGame()).isSameAs(originalGame);
        assertThat(originalGame.getPlayers().get(guest.playerId())).isSameAs(originalSeat);
        assertThat(originalSeat.getHand()).containsExactlyElementsOf(hand);
        assertThat(originalGame.getDeck()).containsExactlyElementsOf(deck);
        assertThat(f.room.getPlayers().stream().map(p -> p.getPlayerId())).containsExactlyElementsOf(order);
        assertThat(view(f, guest).game()).isEqualTo(before);
        assertThat(originalGame.getCurrentPlayerId()).isEqualTo(guest.playerId());
        assertThat(f.room.getStatus()).isEqualTo(RoomStatus.IN_GAME);
    }

    @Test
    void fourPlayersWaitForBothMissingSeatsAndNeverDuplicateThem() {
        Fixture f = fixture(4);
        var second = f.players.get(1);
        var fourth = f.players.get(3);
        var before = view(f, second).game();
        var deck = List.copyOf(f.room.getGame().getDeck());
        f.rooms.leaveRoom(f.host.roomCode(), second.playerId(), second.sessionToken());
        f.rooms.leaveRoom(f.host.roomCode(), fourth.playerId(), fourth.sessionToken());

        f.rooms.joinRoom(f.host.roomCode(), null, second.playerId(), second.sessionToken());
        assertThatThrownBy(() -> f.games.resumeMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken()))
                .hasMessageContaining("Waiting");
        assertThat(f.room.getGame().getStatus()).isEqualTo(ScopaGameStatus.PAUSED);
        f.rooms.joinRoom(f.host.roomCode(), null, fourth.playerId(), fourth.sessionToken());
        f.rooms.joinRoom(f.host.roomCode(), null, fourth.playerId(), fourth.sessionToken());
        assertThat(f.room.getPlayers()).hasSize(4);
        assertThat(f.room.getGame().getPlayers()).hasSize(4);
        f.games.resumeMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken());
        assertThat(view(f, second).game()).isEqualTo(before);
        assertThat(f.room.getGame().getDeck()).containsExactlyElementsOf(deck);
    }

    @Test
    void disconnectAndRefreshReclaimTheSeatButRequireHostResume() {
        Fixture f = fixture(2);
        var guest = f.players.get(1);
        var before = view(f, guest).game();
        f.rooms.markConnected(f.host.roomCode(), guest.playerId(), guest.sessionToken(), false);
        assertThat(f.room.getGame().getStatus()).isEqualTo(ScopaGameStatus.PAUSED);
        f.rooms.markConnected(f.host.roomCode(), guest.playerId(), guest.sessionToken(), true);
        assertThat(f.room.getGame().getStatus()).isEqualTo(ScopaGameStatus.PAUSED);
        assertThat(view(f, guest).game()).usingRecursiveComparison().ignoringFields("status").isEqualTo(before);
        f.games.resumeMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken());
        assertThat(view(f, guest).game()).isEqualTo(before);
    }

    @Test
    void evenWhenEveryoneLeavesRoomAndHostIdentityRemainReserved() {
        Fixture f = fixture(2);
        var original = f.room.getGame();
        for (var player : f.players) {
            assertThat(f.rooms.leaveRoom(f.host.roomCode(), player.playerId(), player.sessionToken())).isPresent();
        }
        assertThat(f.rooms.roomExists(f.host.roomCode())).isTrue();
        assertThat(f.room.getPlayers()).hasSize(2);
        assertThat(f.room.getGame()).isSameAs(original);
        assertThat(f.room.getHostPlayerId()).isEqualTo(f.host.playerId());
        for (var player : f.players) {
            f.rooms.joinRoom(f.host.roomCode(), null, player.playerId(), player.sessionToken());
        }
        f.games.resumeMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken());
        assertThat(original.getStatus()).isEqualTo(ScopaGameStatus.ACTIVE);
    }

    @Test
    void namesCannotReclaimReservedSeatsAndNewPlayersCannotEnterStartedMatches() {
        Fixture f = fixture(2);
        var guest = f.players.get(1);
        f.rooms.leaveRoom(f.host.roomCode(), guest.playerId(), guest.sessionToken());
        assertThatThrownBy(() -> f.rooms.joinRoom(f.host.roomCode(), "Manon"))
                .hasMessageContaining("original player session");
        assertThatThrownBy(() -> f.rooms.joinRoom(f.host.roomCode(), "Someone else"))
                .hasMessageContaining("already started");
        assertThatThrownBy(() -> f.rooms.joinRoom(f.host.roomCode(), "Manon", guest.playerId(), "bad-token"))
                .hasMessageContaining("Invalid player session");
        assertThatThrownBy(() -> f.rooms.joinRoom(f.host.roomCode(), "Manon", "unknown-player", guest.sessionToken()))
                .hasMessageContaining("reserved seat is no longer available");
        assertThat(f.room.getPlayers()).hasSize(2);
    }

    @Test
    void hostCanAbandonPausedMatchWithoutScoringOrDeclaringWinner() {
        Fixture f = fixture(2);
        var guest = f.players.get(1);
        var game = f.room.getGame();
        var before = view(f, guest).game();
        assertThatThrownBy(() -> f.games.endPausedMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken()))
                .hasMessageContaining("paused");
        f.rooms.leaveRoom(f.host.roomCode(), guest.playerId(), guest.sessionToken());
        assertThatThrownBy(() -> f.games.endPausedMatch(f.host.roomCode(), guest.playerId(), guest.sessionToken()))
                .hasMessageContaining("host");

        RoomSnapshot lobby = f.games.endPausedMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken());

        assertThat(lobby.status()).isEqualTo(RoomStatus.LOBBY);
        assertThat(lobby.game()).isNull();
        assertThat(lobby.players()).singleElement().satisfies(player -> {
            assertThat(player.playerId()).isEqualTo(f.host.playerId());
            assertThat(player.ready()).isFalse();
        });
        assertThat(game.getWinnerPlayerId()).isNull();
        assertThat(game.getRoundResult()).isNull();
        assertThatThrownBy(() -> f.rooms.joinRoom(f.host.roomCode(), "Manon", guest.playerId(), guest.sessionToken()))
                .hasMessageContaining("host may have ended the game");
        assertThat(ScopaGameSnapshot.forPlayer(game, guest.playerId(), new ScopaRules()))
                .usingRecursiveComparison().ignoringFields("status").isEqualTo(before);
    }

    @Test
    void leaveBetweenRoundsPreservesScoresAndDoesNotStartAnotherRoundOnResume() {
        Fixture f = fixture(2);
        var game = f.room.getGame();
        game.setStatus(ScopaGameStatus.ROUND_FINISHED);
        game.setCurrentPlayerId(null);
        var before = view(f, f.players.get(1)).game();
        var guest = f.players.get(1);
        f.rooms.leaveRoom(f.host.roomCode(), guest.playerId(), guest.sessionToken());
        f.rooms.joinRoom(f.host.roomCode(), null, guest.playerId(), guest.sessionToken());
        f.games.resumeMatch(f.host.roomCode(), f.host.playerId(), f.host.sessionToken());
        assertThat(view(f, guest).game()).isEqualTo(before);
    }

    private RoomSnapshot view(Fixture f, RoomSessionResponse player) {
        return f.games.snapshotForPlayer(f.host.roomCode(), player.playerId(), player.sessionToken());
    }

    private Fixture fixture(int count) {
        RoomService rooms = new RoomService();
        ScopaGameService games = new ScopaGameService(rooms, new ScopaRules(), new ScopaScoringService(), new Random(12));
        RoomSessionResponse host = rooms.createRoom("Quentin");
        List<RoomSessionResponse> players = new ArrayList<>();
        players.add(host);
        for (String name : List.of("Manon", "Jérémie", "Lina").subList(0, count - 1)) {
            players.add(rooms.joinRoom(host.roomCode(), name));
        }
        List<ScopaCard> deck = new ArrayList<>(ScopaDeck.ordered());
        List<ScopaCard> firstHands = List.of(
                take(deck, ScopaSuit.CLUBS, 2), take(deck, ScopaSuit.GOLD, 6), take(deck, ScopaSuit.CUPS, 9),
                take(deck, ScopaSuit.GOLD, 3), take(deck, ScopaSuit.SWORDS, 7), take(deck, ScopaSuit.CUPS, 10));
        deck.addAll(0, firstHands);
        games.startMatchWithDeck(host.roomCode(), host.playerId(), host.sessionToken(), deck, players.get(1).playerId());
        Room room = rooms.withAuthorizedRoom(host.roomCode(), host.playerId(), host.sessionToken(), (r, p) -> r);
        ScopaGameState game = room.getGame();
        ScopaPlayerState guest = game.getPlayers().get(players.get(1).playerId());
        guest.getCapturedCards().add(game.getDeck().removeFirst());
        guest.incrementScopasThisRound();
        guest.setRoundPoints(3);
        guest.setTotalPoints(7);
        game.setRoundNumber(3);
        game.setLastCapturingPlayerId(players.get(1).playerId());
        game.recordMove(host.playerId(), "Quentin", firstHands.getFirst(), List.of(), false);
        game.recordMove(players.get(1).playerId(), "Manon", firstHands.get(3), guest.getCapturedCards(), true);
        game.setLastEvent("SCOPA");
        return new Fixture(rooms, games, host, players, room);
    }

    private ScopaCard take(List<ScopaCard> deck, ScopaSuit suit, int value) {
        ScopaCard card = deck.stream().filter(c -> c.suit() == suit && c.value() == value).findFirst().orElseThrow();
        deck.remove(card);
        return card;
    }

    private record Fixture(RoomService rooms, ScopaGameService games, RoomSessionResponse host,
                           List<RoomSessionResponse> players, Room room) {}
}
