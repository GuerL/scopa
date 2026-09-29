package com.guerl.scopa.game;

import com.guerl.scopa.multiplayer.player.Player;
import com.guerl.scopa.multiplayer.room.Room;
import com.guerl.scopa.multiplayer.room.RoomException;
import com.guerl.scopa.multiplayer.room.RoomService;
import com.guerl.scopa.multiplayer.room.RoomSnapshot;
import com.guerl.scopa.multiplayer.room.RoomStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
public class ScopaGameService {

    public static final int WINNING_SCORE = 11;

    private final RoomService roomService;
    private final ScopaRules rules;
    private final ScopaScoringService scoringService;
    private final Random random;

    @Autowired
    public ScopaGameService(RoomService roomService) {
        this(roomService, new ScopaRules(), new ScopaScoringService(), new SecureRandom());
    }

    ScopaGameService(RoomService roomService, ScopaRules rules, ScopaScoringService scoringService, Random random) {
        this.roomService = roomService;
        this.rules = rules;
        this.scoringService = scoringService;
        this.random = random;
    }

    public RoomSnapshot startMatch(String roomCode, String playerId, String sessionToken) {
        return roomService.withAuthorizedRoom(roomCode, playerId, sessionToken, (room, player) -> {
            requireHost(room, player);
            if (room.getGame() != null && room.getGame().getStatus() == ScopaGameStatus.ACTIVE) {
                throw new RoomException("Game already started");
            }
            if (room.getPlayers().size() < Room.MIN_PLAYERS) {
                throw new RoomException("At least two players are required to start");
            }
            if (room.getPlayers().stream().anyMatch(candidate -> !candidate.isReady())) {
                throw new RoomException("All players must be ready");
            }

            List<String> playerOrder = playerOrder(room);
            ScopaGameState game = new ScopaGameState();
            for (String id : playerOrder) {
                game.getPlayers().put(id, new ScopaPlayerState(id));
            }
            String starter = playerOrder.get(random.nextInt(playerOrder.size()));
            setupRound(game, playerOrder, starter, 1, true, ScopaDeck.shuffled(random));
            room.setGame(game);
            room.setStatus(RoomStatus.IN_GAME);
            return RoomSnapshot.from(room, player.getPlayerId(), rules);
        });
    }

    RoomSnapshot startMatchWithDeck(String roomCode, String playerId, String sessionToken, List<ScopaCard> deck, String starterPlayerId) {
        return roomService.withAuthorizedRoom(roomCode, playerId, sessionToken, (room, player) -> {
            requireHost(room, player);
            List<String> playerOrder = playerOrder(room);
            ScopaGameState game = new ScopaGameState();
            for (String id : playerOrder) {
                game.getPlayers().put(id, new ScopaPlayerState(id));
            }
            setupRound(game, playerOrder, starterPlayerId, 1, true, new ArrayList<>(deck));
            room.setGame(game);
            room.setStatus(RoomStatus.IN_GAME);
            return RoomSnapshot.from(room, player.getPlayerId(), rules);
        });
    }

    public RoomSnapshot playCard(String roomCode, PlayCardRequest request) {
        return roomService.withAuthorizedRoom(roomCode, request.playerId(), request.sessionToken(), (room, player) -> {
            ScopaGameState game = requireGame(room);
            if (game.getStatus() != ScopaGameStatus.ACTIVE) {
                throw new RoomException("Match is not active");
            }
            if (!player.getPlayerId().equals(game.getCurrentPlayerId())) {
                throw new RoomException("It is not your turn");
            }

            ScopaPlayerState playerState = game.getPlayers().get(player.getPlayerId());
            ScopaCard playedCard = removeRequiredCard(playerState.getHand(), request.cardId());
            List<String> selectedCaptureIds = request.captureCardIds() == null ? List.of() : request.captureCardIds();
            List<List<ScopaCard>> possibleCaptures = rules.possibleCaptures(playedCard, game.getTableCards());

            if (possibleCaptures.isEmpty()) {
                if (!selectedCaptureIds.isEmpty()) {
                    playerState.getHand().add(playedCard);
                    throw new RoomException("That card cannot capture anything");
                }
                game.getTableCards().add(playedCard);
                game.setLastEvent("CARD_PLAYED");
            } else {
                if (!rules.isLegalCapture(playedCard, game.getTableCards(), selectedCaptureIds)) {
                    playerState.getHand().add(playedCard);
                    throw new RoomException("Invalid capture");
                }

                List<ScopaCard> captured = removeCards(game.getTableCards(), selectedCaptureIds);
                playerState.getCapturedCards().add(playedCard);
                playerState.getCapturedCards().addAll(captured);
                game.setLastCapturingPlayerId(player.getPlayerId());
                if (game.getTableCards().isEmpty()) {
                    playerState.incrementScopasThisRound();
                    game.setLastEvent("SCOPA");
                } else {
                    game.setLastEvent("CARDS_CAPTURED");
                }
            }

            afterTurn(room, game);
            return RoomSnapshot.from(room, player.getPlayerId(), rules);
        });
    }

    public RoomSnapshot acknowledgeNextRound(String roomCode, String playerId, String sessionToken) {
        return roomService.withAuthorizedRoom(roomCode, playerId, sessionToken, (room, player) -> {
            ScopaGameState game = requireGame(room);
            if (game.getStatus() != ScopaGameStatus.ROUND_FINISHED) {
                throw new RoomException("Round is not finished");
            }
            game.getPlayers().get(player.getPlayerId()).setRoundAcknowledged(true);
            if (game.getPlayers().values().stream().allMatch(ScopaPlayerState::isRoundAcknowledged)) {
                List<String> order = playerOrder(room);
                String nextStarter = nextPlayerId(order, game.getStartingPlayerId());
                setupRound(game, order, nextStarter, game.getRoundNumber() + 1, false, ScopaDeck.shuffled(random));
            }
            return RoomSnapshot.from(room, player.getPlayerId(), rules);
        });
    }

    public RoomSnapshot requestRematch(String roomCode, String playerId, String sessionToken) {
        return roomService.withAuthorizedRoom(roomCode, playerId, sessionToken, (room, player) -> {
            ScopaGameState game = requireGame(room);
            if (game.getStatus() != ScopaGameStatus.MATCH_FINISHED) {
                throw new RoomException("Match is not finished");
            }
            game.getPlayers().get(player.getPlayerId()).setRematchRequested(true);
            if (game.getPlayers().values().stream().allMatch(ScopaPlayerState::isRematchRequested)) {
                List<String> order = playerOrder(room);
                for (ScopaPlayerState playerState : game.getPlayers().values()) {
                    playerState.resetForMatch();
                }
                String starter = order.get(random.nextInt(order.size()));
                setupRound(game, order, starter, 1, true, ScopaDeck.shuffled(random));
                room.setStatus(RoomStatus.IN_GAME);
            }
            return RoomSnapshot.from(room, player.getPlayerId(), rules);
        });
    }

    public RoomSnapshot snapshotForPlayer(String roomCode, String playerId, String sessionToken) {
        return roomService.withAuthorizedRoom(roomCode, playerId, sessionToken,
                (room, player) -> RoomSnapshot.from(room, player.getPlayerId(), rules));
    }

    ScopaRules rules() {
        return rules;
    }

    private void setupRound(
            ScopaGameState game,
            List<String> playerOrder,
            String starter,
            int roundNumber,
            boolean resetTotals,
            List<ScopaCard> deck
    ) {
        game.setStatus(ScopaGameStatus.ACTIVE);
        game.setRoundNumber(roundNumber);
        game.setStartingPlayerId(starter);
        game.setCurrentPlayerId(starter);
        game.setLastCapturingPlayerId(null);
        game.setWinnerPlayerId(null);
        game.setRoundResult(null);
        game.setLastEvent(roundNumber == 1 ? "GAME_STARTED" : "NEXT_ROUND_STARTED");
        game.getDeck().clear();
        game.getTableCards().clear();
        game.getDeck().addAll(deck);

        for (String playerId : playerOrder) {
            ScopaPlayerState player = game.getPlayers().get(playerId);
            if (resetTotals) {
                player.resetForMatch();
            } else {
                player.resetForRound();
            }
        }

        dealHands(game, playerOrder);
        draw(game.getDeck(), game.getTableCards(), 4);
    }

    private void afterTurn(Room room, ScopaGameState game) {
        List<String> order = playerOrder(room);
        boolean handsEmpty = game.getPlayers().values().stream().allMatch(player -> player.getHand().isEmpty());
        if (handsEmpty && !game.getDeck().isEmpty()) {
            dealHands(game, order);
            game.setLastEvent("HAND_DEALT");
        }

        boolean roundOver = game.getDeck().isEmpty()
                && game.getPlayers().values().stream().allMatch(player -> player.getHand().isEmpty());
        if (roundOver) {
            finishRound(room, game, order);
            return;
        }

        game.setCurrentPlayerId(nextPlayerId(order, game.getCurrentPlayerId()));
        if (!"HAND_DEALT".equals(game.getLastEvent()) && !"SCOPA".equals(game.getLastEvent())) {
            game.setLastEvent("TURN_CHANGED");
        }
    }

    private void finishRound(Room room, ScopaGameState game, List<String> order) {
        if (!game.getTableCards().isEmpty() && game.getLastCapturingPlayerId() != null) {
            game.getPlayers().get(game.getLastCapturingPlayerId()).getCapturedCards().addAll(game.getTableCards());
            game.getTableCards().clear();
        }

        ScopaRoundResult result = scoringService.scoreRound(order, game);
        game.setRoundResult(result);
        game.getPlayers().values().forEach(player -> {
            player.setRoundAcknowledged(false);
            player.setRematchRequested(false);
        });

        String winner = winnerIfAny(order, game);
        if (winner == null) {
            game.setStatus(ScopaGameStatus.ROUND_FINISHED);
            game.setCurrentPlayerId(null);
            game.setLastEvent("ROUND_FINISHED");
            return;
        }

        game.setWinnerPlayerId(winner);
        game.setStatus(ScopaGameStatus.MATCH_FINISHED);
        room.setStatus(RoomStatus.MATCH_FINISHED);
        game.setCurrentPlayerId(null);
        game.setLastEvent("GAME_FINISHED");
    }

    private String winnerIfAny(List<String> order, ScopaGameState game) {
        int highest = order.stream()
                .map(game.getPlayers()::get)
                .mapToInt(ScopaPlayerState::getTotalPoints)
                .max()
                .orElse(0);
        if (highest < WINNING_SCORE) {
            return null;
        }

        List<ScopaPlayerState> leaders = order.stream()
                .map(game.getPlayers()::get)
                .filter(player -> player.getTotalPoints() == highest)
                .toList();
        return leaders.size() == 1 ? leaders.getFirst().getPlayerId() : null;
    }

    private void dealHands(ScopaGameState game, List<String> playerOrder) {
        for (String playerId : playerOrder) {
            draw(game.getDeck(), game.getPlayers().get(playerId).getHand(), Math.min(3, game.getDeck().size()));
        }
    }

    private void draw(List<ScopaCard> from, List<ScopaCard> to, int count) {
        for (int i = 0; i < count && !from.isEmpty(); i++) {
            to.add(from.remove(0));
        }
    }

    private ScopaCard removeRequiredCard(List<ScopaCard> cards, String cardId) {
        for (int i = 0; i < cards.size(); i++) {
            if (cards.get(i).id().equals(cardId)) {
                return cards.remove(i);
            }
        }
        throw new RoomException("Card is not in your hand");
    }

    private List<ScopaCard> removeCards(List<ScopaCard> cards, List<String> cardIds) {
        List<ScopaCard> removed = new ArrayList<>();
        for (String cardId : cardIds) {
            removed.add(removeRequiredCard(cards, cardId));
        }
        return removed;
    }

    private ScopaGameState requireGame(Room room) {
        if (room.getGame() == null) {
            throw new RoomException("Game has not started");
        }
        return room.getGame();
    }

    private void requireHost(Room room, Player player) {
        if (!room.getHostPlayerId().equals(player.getPlayerId())) {
            throw new RoomException("Only the host can do that");
        }
    }

    private List<String> playerOrder(Room room) {
        return room.getPlayers().stream().map(Player::getPlayerId).toList();
    }

    private String nextPlayerId(List<String> playerOrder, String playerId) {
        int currentIndex = playerOrder.indexOf(playerId);
        if (currentIndex < 0 || playerOrder.isEmpty()) {
            throw new RoomException("Current player is missing");
        }
        return playerOrder.get((currentIndex + 1) % playerOrder.size());
    }
}
