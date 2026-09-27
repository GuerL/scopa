package com.guerl.scopa.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public final class ScopaDeck {

    private ScopaDeck() {
    }

    public static List<ScopaCard> shuffled(Random random) {
        List<ScopaCard> deck = ordered();
        Collections.shuffle(deck, random);
        return deck;
    }

    public static List<ScopaCard> ordered() {
        List<ScopaCard> deck = new ArrayList<>(40);
        for (ScopaSuit suit : ScopaSuit.values()) {
            for (int value = 1; value <= 10; value++) {
                deck.add(new ScopaCard(suit.name() + "-" + value, suit, value));
            }
        }
        return deck;
    }
}
