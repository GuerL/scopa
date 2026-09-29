package com.guerl.scopa.game;

import com.guerl.scopa.multiplayer.room.RoomException;
import com.guerl.scopa.multiplayer.room.RoomService;
import com.guerl.scopa.multiplayer.room.RoomSessionResponse;
import com.guerl.scopa.multiplayer.room.RoomSnapshot;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScopaGameTests {

    private final ScopaRules rules = new ScopaRules();

    @Test
    void deckHasFortyUniqueCardsAndTenPerSuit() {
        List<ScopaCard> deck = ScopaDeck.ordered();

        assertThat(deck).hasSize(40);
        assertThat(deck.stream().map(ScopaCard::id)).doesNotHaveDuplicates();
        for (ScopaSuit suit : ScopaSuit.values()) {
            assertThat(deck.stream().filter(card -> card.suit() == suit)).hasSize(10);
        }
    }

    @Test
    void dealCreatesTwoHandsTableAndRemainingDeck() {
        StartedGame started = startedGame(ScopaDeck.ordered());

        assertThat(started.hostView.game().hand()).hasSize(3);
        assertThat(started.guestView.game().hand()).hasSize(3);
        assertThat(started.hostView.game().tableCards()).hasSize(4);
        assertThat(started.hostView.game().deckRemaining()).isEqualTo(30);
    }

    @Test
    void exactCaptureHasPriorityOverCombinations() {
        ScopaCard played = card("PLAYED", ScopaSuit.GOLD, 7);
        List<ScopaCard> table = List.of(
                card("EXACT", ScopaSuit.CUPS, 7),
                card("FIVE", ScopaSuit.SWORDS, 5),
                card("TWO", ScopaSuit.CLUBS, 2)
        );

        assertThat(rules.possibleCaptures(played, table))
                .containsExactly(List.of(table.getFirst()));
        assertThat(rules.isLegalCapture(played, table, List.of("EXACT"))).isTrue();
        assertThat(rules.isLegalCapture(played, table, List.of("FIVE", "TWO"))).isFalse();
    }

    @Test
    void combinationsCanUseTwoOrMoreCardsAndFindAlternatives() {
        ScopaCard played = card("PLAYED", ScopaSuit.GOLD, 7);

        assertThat(rules.isLegalCapture(played, List.of(card("FIVE", ScopaSuit.CUPS, 5), card("TWO", ScopaSuit.CLUBS, 2)),
                List.of("FIVE", "TWO"))).isTrue();

        List<List<ScopaCard>> alternatives = rules.possibleCaptures(played, List.of(
                card("FIVE", ScopaSuit.CUPS, 5),
                card("TWO", ScopaSuit.CLUBS, 2),
                card("FOUR", ScopaSuit.SWORDS, 4),
                card("THREE", ScopaSuit.CLUBS, 3)
        ));
        assertThat(captureIds(alternatives)).contains(Set.of("FIVE", "TWO"), Set.of("FOUR", "THREE"));

        assertThat(rules.isLegalCapture(played, List.of(
                card("FOUR", ScopaSuit.SWORDS, 4),
                card("TWO", ScopaSuit.CLUBS, 2),
                card("ONE", ScopaSuit.CUPS, 1)
        ), List.of("FOUR", "TWO", "ONE"))).isTrue();
    }

    @Test
    void noCaptureAddsPlayedCardToTable() {
        StartedGame started = startedGame(deck(
                card("H1", ScopaSuit.GOLD, 10), card("H2", ScopaSuit.CUPS, 10), card("H3", ScopaSuit.SWORDS, 10),
                card("G1", ScopaSuit.GOLD, 9), card("G2", ScopaSuit.CUPS, 9), card("G3", ScopaSuit.SWORDS, 9),
                card("T1", ScopaSuit.GOLD, 1), card("T2", ScopaSuit.CUPS, 1), card("T3", ScopaSuit.SWORDS, 1), card("T4", ScopaSuit.CLUBS, 1)
        ), false);

        ScopaCard played = started.hostView.game().hand().getFirst();
        RoomSnapshot after = started.service.playCard(started.roomCode, new PlayCardRequest(
                started.host.playerId(), started.host.sessionToken(), played.id(), List.of()
        ));

        assertThat(after.game().tableCards()).extracting(ScopaCard::id).contains(played.id());
    }

    @Test
    void scopaIncrementsWhenCaptureClearsTable() {
        StartedGame started = startedGame(deck(
                card("H1", ScopaSuit.GOLD, 7), card("H2", ScopaSuit.CUPS, 10), card("H3", ScopaSuit.SWORDS, 10),
                card("G1", ScopaSuit.GOLD, 9), card("G2", ScopaSuit.CUPS, 9), card("G3", ScopaSuit.SWORDS, 9),
                card("T1", ScopaSuit.CUPS, 7)
        ), false);

        RoomSnapshot after = started.service.playCard(started.roomCode, new PlayCardRequest(
                started.host.playerId(), started.host.sessionToken(), "H1", List.of("T1")
        ));

        assertThat(after.game().tableCards()).isEmpty();
        assertThat(after.game().players().stream()
                .filter(player -> player.playerId().equals(started.host.playerId()))
                .findFirst().orElseThrow().scopasThisRound()).isEqualTo(1);
    }

    @Test
    void scoringAppliesCustomRulesWithoutPrimiera() {
        ScopaGameState game = new ScopaGameState();
        ScopaPlayerState left = new ScopaPlayerState("left");
        ScopaPlayerState right = new ScopaPlayerState("right");
        game.getPlayers().put("left", left);
        game.getPlayers().put("right", right);
        left.getCapturedCards().addAll(deck(
                card("G7", ScopaSuit.GOLD, 7),
                card("G10", ScopaSuit.GOLD, 10),
                card("G1", ScopaSuit.GOLD, 1),
                card("C1", ScopaSuit.CUPS, 1),
                card("C2", ScopaSuit.CUPS, 2)
        ));
        right.getCapturedCards().addAll(deck(
                card("G2", ScopaSuit.GOLD, 2),
                card("S1", ScopaSuit.SWORDS, 1),
                card("S2", ScopaSuit.SWORDS, 2)
        ));
        left.incrementScopasThisRound();
        left.incrementScopasThisRound();

        ScopaRoundResult result = new ScopaScoringService().scoreRound(List.of("left", "right"), game);

        assertThat(roundPoints(result, "left")).isEqualTo(6);
        assertThat(roundPoints(result, "right")).isZero();
        assertThat(result.lines()).extracting(ScopaScoreLine::label).doesNotContain("Primiera");
    }

    @Test
    void scoringAppliesCustomRulesForThreePlayers() {
        ScopaGameState game = gameWithPlayers("p1", "p2", "p3");
        game.getPlayers().get("p1").getCapturedCards().addAll(deck(
                card("P1-G7", ScopaSuit.GOLD, 7),
                card("P1-G10", ScopaSuit.GOLD, 10),
                card("P1-C1", ScopaSuit.CUPS, 1),
                card("P1-C2", ScopaSuit.CUPS, 2)
        ));
        game.getPlayers().get("p2").getCapturedCards().addAll(deck(
                card("P2-G1", ScopaSuit.GOLD, 1),
                card("P2-G2", ScopaSuit.GOLD, 2),
                card("P2-G3", ScopaSuit.GOLD, 3)
        ));
        game.getPlayers().get("p3").getCapturedCards().add(card("P3-S1", ScopaSuit.SWORDS, 1));
        game.getPlayers().get("p3").incrementScopasThisRound();

        ScopaRoundResult result = new ScopaScoringService().scoreRound(List.of("p1", "p2", "p3"), game);

        assertThat(roundPoints(result, "p1")).isEqualTo(3);
        assertThat(roundPoints(result, "p2")).isEqualTo(1);
        assertThat(roundPoints(result, "p3")).isEqualTo(1);
    }

    @Test
    void scoringAppliesCustomRulesForFourPlayers() {
        ScopaGameState game = gameWithPlayers("p1", "p2", "p3", "p4");
        game.getPlayers().get("p1").getCapturedCards().addAll(deck(
                card("P1-G7", ScopaSuit.GOLD, 7),
                card("P1-C1", ScopaSuit.CUPS, 1),
                card("P1-C2", ScopaSuit.CUPS, 2),
                card("P1-C3", ScopaSuit.CUPS, 3)
        ));
        game.getPlayers().get("p2").getCapturedCards().addAll(deck(
                card("P2-G1", ScopaSuit.GOLD, 1),
                card("P2-G2", ScopaSuit.GOLD, 2),
                card("P2-G10", ScopaSuit.GOLD, 10)
        ));
        game.getPlayers().get("p3").getCapturedCards().add(card("P3-S1", ScopaSuit.SWORDS, 1));
        game.getPlayers().get("p4").getCapturedCards().add(card("P4-S1", ScopaSuit.SWORDS, 1));
        game.getPlayers().get("p4").incrementScopasThisRound();
        game.getPlayers().get("p4").incrementScopasThisRound();

        ScopaRoundResult result = new ScopaScoringService().scoreRound(List.of("p1", "p2", "p3", "p4"), game);

        assertThat(roundPoints(result, "p1")).isEqualTo(2);
        assertThat(roundPoints(result, "p2")).isEqualTo(2);
        assertThat(roundPoints(result, "p3")).isZero();
        assertThat(roundPoints(result, "p4")).isEqualTo(2);
    }

    @Test
    void tiedCardsAndGoldDoNotScore() {
        ScopaGameState game = new ScopaGameState();
        ScopaPlayerState left = new ScopaPlayerState("left");
        ScopaPlayerState right = new ScopaPlayerState("right");
        game.getPlayers().put("left", left);
        game.getPlayers().put("right", right);
        left.getCapturedCards().addAll(deck(card("L1", ScopaSuit.GOLD, 1), card("L2", ScopaSuit.CUPS, 2)));
        right.getCapturedCards().addAll(deck(card("R1", ScopaSuit.GOLD, 3), card("R2", ScopaSuit.SWORDS, 4)));

        ScopaRoundResult result = new ScopaScoringService().scoreRound(List.of("left", "right"), game);

        assertThat(roundPoints(result, "left")).isZero();
        assertThat(roundPoints(result, "right")).isZero();
    }

    @Test
    void tiedCardsAmongMultiplePlayersDoNotScore() {
        ScopaGameState game = gameWithPlayers("p1", "p2", "p3");
        game.getPlayers().get("p1").getCapturedCards().addAll(deck(card("P1-G1", ScopaSuit.GOLD, 1), card("P1-C1", ScopaSuit.CUPS, 1)));
        game.getPlayers().get("p2").getCapturedCards().addAll(deck(card("P2-S1", ScopaSuit.SWORDS, 1), card("P2-C1", ScopaSuit.CLUBS, 1)));
        game.getPlayers().get("p3").getCapturedCards().add(card("P3-C1", ScopaSuit.CUPS, 2));

        ScopaRoundResult result = new ScopaScoringService().scoreRound(List.of("p1", "p2", "p3"), game);

        assertThat(linePoints(result, "Most cards", "p1")).isZero();
        assertThat(linePoints(result, "Most cards", "p2")).isZero();
        assertThat(linePoints(result, "Most cards", "p3")).isZero();
    }

    @Test
    void tiedGoldAmongMultiplePlayersDoNotScore() {
        ScopaGameState game = gameWithPlayers("p1", "p2", "p3");
        game.getPlayers().get("p1").getCapturedCards().addAll(deck(card("P1-G1", ScopaSuit.GOLD, 1), card("P1-G2", ScopaSuit.GOLD, 2)));
        game.getPlayers().get("p2").getCapturedCards().addAll(deck(card("P2-G3", ScopaSuit.GOLD, 3), card("P2-G4", ScopaSuit.GOLD, 4)));
        game.getPlayers().get("p3").getCapturedCards().add(card("P3-G5", ScopaSuit.GOLD, 5));

        ScopaRoundResult result = new ScopaScoringService().scoreRound(List.of("p1", "p2", "p3"), game);

        assertThat(linePoints(result, "Most Gold", "p1")).isZero();
        assertThat(linePoints(result, "Most Gold", "p2")).isZero();
        assertThat(linePoints(result, "Most Gold", "p3")).isZero();
    }

    @Test
    void winnerRequiresElevenAndEqualScoresContinue() {
        StartedGame started = startedGame(ScopaDeck.ordered());
        ScopaGameState game = new ScopaGameState();
        ScopaPlayerState left = new ScopaPlayerState(started.host.playerId());
        ScopaPlayerState right = new ScopaPlayerState(started.guest.playerId());
        left.setTotalPoints(11);
        right.setTotalPoints(11);
        game.getPlayers().put(left.getPlayerId(), left);
        game.getPlayers().put(right.getPlayerId(), right);
        game.setStatus(ScopaGameStatus.ROUND_FINISHED);

        assertThat(game.getWinnerPlayerId()).isNull();
    }

    @Test
    void personalizedSnapshotNeverContainsOpponentHandCards() {
        StartedGame started = startedGame(ScopaDeck.ordered());

        Set<String> hostHand = ids(started.hostView.game().hand());
        Set<String> guestHand = ids(started.guestView.game().hand());

        assertThat(hostHand).hasSize(3);
        assertThat(guestHand).hasSize(3);
        assertThat(hostHand).doesNotContainAnyElementsOf(guestHand);
        assertThat(started.hostView.game().players().stream()
                .filter(player -> player.playerId().equals(started.guest.playerId()))
                .findFirst().orElseThrow().handCount()).isEqualTo(3);
    }

    @Test
    void personalizedSnapshotHidesMultipleOpponentHands() {
        StartedGame started = startedGame(3, ScopaDeck.ordered(), true);

        Set<String> viewerHand = ids(started.hostView.game().hand());
        assertThat(started.hostView.game().players())
                .filteredOn(player -> !player.playerId().equals(started.host.playerId()))
                .hasSize(2)
                .allSatisfy(player -> assertThat(player.handCount()).isEqualTo(3));
        for (RoomSessionResponse opponent : started.players.subList(1, started.players.size())) {
            Set<String> opponentHand = ids(started.service.snapshotForPlayer(started.roomCode, opponent.playerId(), opponent.sessionToken()).game().hand());
            assertThat(viewerHand).doesNotContainAnyElementsOf(opponentHand);
        }
    }

    @Test
    void twoPlayerTurnRotationIsCircular() {
        assertTurnRotation(2);
    }

    @Test
    void threePlayerTurnRotationIsCircular() {
        assertTurnRotation(3);
    }

    @Test
    void fourPlayerTurnRotationIsCircular() {
        assertTurnRotation(4);
    }

    @Test
    void threePlayerDealCreatesThreeHandsTableAndRemainingDeck() {
        StartedGame started = startedGame(3, ScopaDeck.ordered(), true);

        assertThat(started.hostView.game().players()).allSatisfy(player -> assertThat(player.handCount()).isEqualTo(3));
        assertThat(started.hostView.game().tableCards()).hasSize(4);
        assertThat(started.hostView.game().deckRemaining()).isEqualTo(27);
    }

    @Test
    void fourPlayerDealCreatesFourHandsTableAndRemainingDeck() {
        StartedGame started = startedGame(4, ScopaDeck.ordered(), true);

        assertThat(started.hostView.game().players()).allSatisfy(player -> assertThat(player.handCount()).isEqualTo(3));
        assertThat(started.hostView.game().tableCards()).hasSize(4);
        assertThat(started.hostView.game().deckRemaining()).isEqualTo(24);
    }

    @Test
    void lastCaptureReceivesRemainingTableCardsWithThreePlayers() {
        assertLastCaptureReceivesRemainingTableCards(3);
    }

    @Test
    void lastCaptureReceivesRemainingTableCardsWithFourPlayers() {
        assertLastCaptureReceivesRemainingTableCards(4);
    }

    @Test
    void roomStartsWithTwoReadyPlayers() {
        assertRoomStartsWithReadyPlayers(2);
    }

    @Test
    void roomStartsWithThreeReadyPlayers() {
        assertRoomStartsWithReadyPlayers(3);
    }

    @Test
    void roomStartsWithFourReadyPlayers() {
        assertRoomStartsWithReadyPlayers(4);
    }

    @Test
    void turnValidationRejectsWrongPlayerCardNotInHandAndInvalidCapture() {
        StartedGame started = startedGame(ScopaDeck.ordered());
        String currentPlayerId = started.hostView.game().currentPlayerId();
        RoomSessionResponse current = currentPlayerId.equals(started.host.playerId()) ? started.host : started.guest;
        RoomSessionResponse other = currentPlayerId.equals(started.host.playerId()) ? started.guest : started.host;
        RoomSnapshot currentView = started.service.snapshotForPlayer(started.roomCode, current.playerId(), current.sessionToken());
        ScopaCard card = currentView.game().hand().getFirst();

        assertThatThrownBy(() -> started.service.playCard(started.roomCode,
                new PlayCardRequest(other.playerId(), other.sessionToken(), card.id(), List.of())))
                .isInstanceOf(RoomException.class)
                .hasMessageContaining("not your turn");

        assertThatThrownBy(() -> started.service.playCard(started.roomCode,
                new PlayCardRequest(current.playerId(), current.sessionToken(), "MISSING", List.of())))
                .isInstanceOf(RoomException.class)
                .hasMessageContaining("Card is not in your hand");

        if (!currentView.game().possibleCaptures().isEmpty()) {
            assertThatThrownBy(() -> started.service.playCard(started.roomCode,
                    new PlayCardRequest(current.playerId(), current.sessionToken(), card.id(), List.of("NOPE"))))
                    .isInstanceOf(RoomException.class)
                    .hasMessageContaining("Invalid capture");
        }
    }

    @Test
    void realisticFullRoundRefillsHandsEmptiesDeckAndScores() {
        StartedGame started = startedGame(ScopaDeck.ordered());

        RoomSnapshot snapshot = started.hostView;
        for (int i = 0; i < 40 && snapshot.game().status() == ScopaGameStatus.ACTIVE; i++) {
            String currentId = snapshot.game().currentPlayerId();
            RoomSessionResponse current = currentId.equals(started.host.playerId()) ? started.host : started.guest;
            RoomSnapshot currentView = started.service.snapshotForPlayer(started.roomCode, current.playerId(), current.sessionToken());
            ScopaCard card = currentView.game().hand().getFirst();
            List<String> captureIds = currentView.game().possibleCaptures().stream()
                    .filter(option -> option.handCardId().equals(card.id()))
                    .findFirst()
                    .map(ScopaCaptureOption::tableCardIds)
                    .orElse(List.of());
            snapshot = started.service.playCard(started.roomCode,
                    new PlayCardRequest(current.playerId(), current.sessionToken(), card.id(), captureIds));
        }

        assertThat(snapshot.game().status()).isIn(ScopaGameStatus.ROUND_FINISHED, ScopaGameStatus.MATCH_FINISHED);
        assertThat(snapshot.game().deckRemaining()).isZero();
        assertThat(snapshot.game().tableCards()).isEmpty();
        assertThat(snapshot.game().roundResult()).isNotNull();
        assertThat(snapshot.game().players()).allSatisfy(player -> assertThat(player.handCount()).isZero());
    }

    private StartedGame startedGame(List<ScopaCard> deck) {
        return startedGame(deck, true);
    }

    private StartedGame startedGame(List<ScopaCard> deck, boolean pad) {
        return startedGame(2, deck, pad);
    }

    private StartedGame startedGame(int playerCount, List<ScopaCard> deck, boolean pad) {
        RoomService roomService = new RoomService();
        ScopaGameService service = new ScopaGameService(roomService, rules, new ScopaScoringService(), new Random(1));
        List<RoomSessionResponse> players = createReadyPlayers(roomService, playerCount);
        RoomSessionResponse host = players.getFirst();
        RoomSessionResponse guest = players.get(1);
        RoomSnapshot hostView = service.startMatchWithDeck(host.roomCode(), host.playerId(), host.sessionToken(), pad ? padDeck(deck) : deck, host.playerId());
        RoomSnapshot guestView = service.snapshotForPlayer(host.roomCode(), guest.playerId(), guest.sessionToken());
        return new StartedGame(service, host.roomCode(), host, guest, players, hostView, guestView);
    }

    private List<RoomSessionResponse> createReadyPlayers(RoomService roomService, int playerCount) {
        List<RoomSessionResponse> players = new ArrayList<>();
        players.add(roomService.createRoom("Player 1"));
        for (int i = 2; i <= playerCount; i++) {
            players.add(roomService.joinRoom(players.getFirst().roomCode(), "Player " + i));
        }
        for (RoomSessionResponse player : players) {
            roomService.setReady(player.roomCode(), player.playerId(), player.sessionToken(), true);
        }
        return players;
    }

    private List<ScopaCard> padDeck(List<ScopaCard> cards) {
        List<ScopaCard> deck = new ArrayList<>(cards);
        Set<String> ids = ids(deck);
        for (ScopaCard card : ScopaDeck.ordered()) {
            if (ids.add(card.id())) {
                deck.add(card);
            }
        }
        return deck;
    }

    private static ScopaCard card(String id, ScopaSuit suit, int value) {
        return new ScopaCard(id, suit, value);
    }

    private static List<ScopaCard> deck(ScopaCard... cards) {
        return List.of(cards);
    }

    private static Set<String> ids(List<ScopaCard> cards) {
        return cards.stream().map(ScopaCard::id).collect(java.util.stream.Collectors.toSet());
    }

    private static Set<Set<String>> captureIds(List<List<ScopaCard>> captures) {
        return captures.stream()
                .map(capture -> new HashSet<>(ids(capture)))
                .collect(java.util.stream.Collectors.toSet());
    }

    private void assertTurnRotation(int playerCount) {
        StartedGame started = startedGame(playerCount, noCaptureDeck(playerCount), false);
        RoomSnapshot snapshot = started.hostView;

        for (int i = 0; i < playerCount; i++) {
            RoomSessionResponse expected = started.players.get(i % playerCount);
            assertThat(snapshot.game().currentPlayerId()).isEqualTo(expected.playerId());
            RoomSnapshot currentView = started.service.snapshotForPlayer(started.roomCode, expected.playerId(), expected.sessionToken());
            ScopaCard card = currentView.game().hand().getFirst();
            snapshot = started.service.playCard(started.roomCode,
                    new PlayCardRequest(expected.playerId(), expected.sessionToken(), card.id(), List.of()));
        }
        assertThat(snapshot.game().currentPlayerId()).isEqualTo(started.players.getFirst().playerId());
    }

    private void assertRoomStartsWithReadyPlayers(int playerCount) {
        RoomService roomService = new RoomService();
        ScopaGameService service = new ScopaGameService(roomService, rules, new ScopaScoringService(), new Random(1));
        List<RoomSessionResponse> players = createReadyPlayers(roomService, playerCount);

        RoomSnapshot snapshot = service.startMatch(players.getFirst().roomCode(), players.getFirst().playerId(), players.getFirst().sessionToken());

        assertThat(snapshot.game()).isNotNull();
        assertThat(snapshot.game().players()).hasSize(playerCount);
    }

    private void assertLastCaptureReceivesRemainingTableCards(int playerCount) {
        RoomService roomService = new RoomService();
        ScopaGameService service = new ScopaGameService(roomService, rules, new ScopaScoringService(), new Random(1));
        List<RoomSessionResponse> players = createReadyPlayers(roomService, playerCount);
        RoomSessionResponse host = players.getFirst();
        service.startMatchWithDeck(host.roomCode(), host.playerId(), host.sessionToken(), ScopaDeck.ordered(), host.playerId());

        RoomSnapshot snapshot = roomService.withAuthorizedRoom(host.roomCode(), host.playerId(), host.sessionToken(), (room, player) -> {
            ScopaGameState game = room.getGame();
            String lastCapturerId = players.get(playerCount - 1).playerId();
            game.getTableCards().clear();
            game.getTableCards().addAll(deck(card("TABLE-1", ScopaSuit.CUPS, 1), card("TABLE-2", ScopaSuit.CLUBS, 2)));
            game.getPlayers().values().forEach(playerState -> {
                playerState.getHand().clear();
                playerState.getCapturedCards().clear();
            });
            game.getDeck().clear();
            game.getPlayers().get(lastCapturerId).getCapturedCards().add(card("CAPTURED", ScopaSuit.GOLD, 7));
            game.setLastCapturingPlayerId(lastCapturerId);
            ReflectionTestUtils.invokeMethod(service, "finishRound", room, game, players.stream().map(RoomSessionResponse::playerId).toList());
            return RoomSnapshot.from(room, host.playerId(), rules);
        });

        ScopaPlayerPublicSnapshot lastCapturer = snapshot.game().players().stream()
                .filter(player -> player.playerId().equals(players.get(playerCount - 1).playerId()))
                .findFirst()
                .orElseThrow();
        assertThat(snapshot.game().tableCards()).isEmpty();
        assertThat(lastCapturer.capturedCount()).isEqualTo(3);
    }

    private ScopaGameState gameWithPlayers(String... playerIds) {
        ScopaGameState game = new ScopaGameState();
        for (String playerId : playerIds) {
            game.getPlayers().put(playerId, new ScopaPlayerState(playerId));
        }
        return game;
    }

    private int roundPoints(ScopaRoundResult result, String playerId) {
        return result.players().stream()
                .filter(player -> player.playerId().equals(playerId))
                .findFirst()
                .orElseThrow()
                .roundPoints();
    }

    private int linePoints(ScopaRoundResult result, String label, String playerId) {
        return result.lines().stream()
                .filter(line -> line.label().equals(label))
                .findFirst()
                .orElseThrow()
                .players().stream()
                .filter(player -> player.playerId().equals(playerId))
                .findFirst()
                .orElseThrow()
                .points();
    }

    private List<ScopaCard> noCaptureDeck(int playerCount) {
        List<ScopaCard> cards = new ArrayList<>();
        int[] handValues = {10, 9, 8, 7};
        for (int playerIndex = 0; playerIndex < playerCount; playerIndex++) {
            for (int cardIndex = 1; cardIndex <= 3; cardIndex++) {
                cards.add(card("P" + playerIndex + "-H" + cardIndex, ScopaSuit.values()[playerIndex], handValues[playerIndex]));
            }
        }
        for (int i = 1; i <= 4; i++) {
            cards.add(card("TABLE-" + i, ScopaSuit.CUPS, 1));
        }
        return cards;
    }

    private record StartedGame(
            ScopaGameService service,
            String roomCode,
            RoomSessionResponse host,
            RoomSessionResponse guest,
            List<RoomSessionResponse> players,
            RoomSnapshot hostView,
            RoomSnapshot guestView
    ) {
    }
}
